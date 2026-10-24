import {useEffect} from 'react';
import {getDb} from '../db';
import {getAdapter, putAdapter, type ObdAdapter} from '../db/obdRepos';
import {useObdStore, type ObdLink} from '../stores/obdStore';
import {usePreferencesStore} from '../stores/preferencesStore';
import {useRecordingStore} from '../stores/recordingStore';
import {useActiveVehicle} from '../stores/vehicleStore';
import type {FuelType} from '../services/vehicleService';
import {bleStatus, cancelConnect, connectAdapter, onBleStatus, type AdapterLink, type BleStatus} from './bleTransport';
import {boostKpa, economyL100, fuelFlowLph, GearEstimator} from './derive';
import {createPollLoop} from './pollLoop';

/** Waits before trying the adapter again after a drop or failure, in ms. */
const BACKOFF_MS = [2_000, 5_000, 10_000, 30_000];

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const linkFor = (status: BleStatus): ObdLink => (status === 'off' ? 'bluetoothOff' : status === 'unauthorized' ? 'unauthorized' : 'unavailable');

const waitForBluetooth = () =>
  new Promise<void>((resolve) => {
    const stop = onBleStatus((status) => {
      if (status === 'on') {
        stop();
        resolve();
      } else if (status !== 'unknown') {
        useObdStore.getState().setLink(linkFor(status));
      }
    });
  });

/** Saves what the car last said to the paired adapter row, for the "last seen" card. */
const saveLastState = (adapter: ObdAdapter) => {
  const db = getDb();
  const s = useObdStore.getState();
  if (!db) {
    return;
  }
  const values = s.values;
  putAdapter(db, {
    ...adapter,
    vin: adapter.vin ?? s.vin,
    supported: s.supported.length > 0 ? s.supported : adapter.supported,
    lastSeen: new Date().toISOString(),
    lastState: {
      mil: s.mil?.on ?? false,
      codeCount: s.mil?.codes ?? 0,
      fuelLevel: values.fuelLevel?.v ?? adapter.lastState?.fuelLevel ?? null,
      voltage: values.voltage?.v ?? adapter.lastState?.voltage ?? null,
      readAt: new Date().toISOString(),
    },
  });
};

/**
 * Keeps the active vehicle's paired adapter connected whenever it can be (spec 2026-10-25,
 * telemetry, section 3): waits for Bluetooth, waits for the adapter (the car being switched on),
 * runs the poll loop into the OBD store, and starts over after a drop.
 */
function runSession(adapter: ObdAdapter, fuel: FuelType): () => void {
  const store = useObdStore.getState;
  let alive = true;
  let link: AdapterLink | null = null;
  let stopLoop: (() => void) | null = null;
  const gear = new GearEstimator();

  const derive = () => {
    const v = store().values;
    const flow = fuelFlowLph({fuelRate: v.fuelRate?.v, maf: v.maf?.v}, fuel);
    store().setDerived({
      fuelFlow: flow,
      economy: economyL100(flow, v.speed?.v ?? null),
      boost: boostKpa(v.map?.v, v.baro?.v),
      gear: v.speed?.v === 0 ? 0 : gear.add(v.rpm?.v, v.speed?.v),
    });
  };

  const loopOnce = async () => {
    const status = await bleStatus();
    if (status !== 'on') {
      store().setLink(linkFor(status));
      await waitForBluetooth();
      return;
    }
    if (store().link !== 'live' && store().link !== 'engineOff') {
      store().setLink('waiting');
    }
    link = await connectAdapter(adapter.deviceId);
    if (!alive) {
      await link.disconnect();
      return;
    }
    store().setLink('connecting');
    let unsupported = false;
    const dropped = new Promise<void>((resolve) => link?.onDisconnect(resolve));
    const loop = createPollLoop(link, {
      onValue: (key, value, at) => {
        store().putValue(key, value, at);
        if (key === 'speed' || key === 'maf' || key === 'fuelRate') {
          derive();
        }
      },
      onStatus: (status) => {
        store().setStatus(status);
        saveLastState(adapter);
      },
      onSupported: (keys) => {
        store().setSupported(keys);
        unsupported = keys.length === 0;
        if (unsupported) {
          store().setLink('unsupported');
        }
      },
      onVin: (vin) => store().setVin(vin),
      onEngine: (running) => store().setLink(running ? 'live' : 'engineOff'),
      onError: () => undefined,
    });
    stopLoop = loop.stop;
    await Promise.race([loop.start(), dropped]);
    loop.stop();
    stopLoop = null;
    saveLastState(adapter);
    await link.disconnect();
    link = null;
    if (unsupported) {
      alive = false;
      return;
    }
    store().endSession();
    store().setLink('waiting');
  };

  void (async () => {
    let failures = 0;
    while (alive) {
      try {
        await loopOnce();
        failures = 0;
      } catch {
        failures += 1;
      }
      if (alive) {
        await sleep(BACKOFF_MS[Math.min(failures, BACKOFF_MS.length - 1)]);
      }
    }
  })();

  return () => {
    alive = false;
    stopLoop?.();
    void (link ? link.disconnect() : cancelConnect(adapter.deviceId));
  };
}

/** Mounted once, in the tabs layout. */
export function useObdLink() {
  const vehicle = useActiveVehicle();
  const vehicleId = vehicle?.id ?? null;
  const fuel = vehicle?.fuel_type ?? 'petrol';
  const deviceId = useObdStore((s) => s.adapter?.deviceId ?? null);

  // The active vehicle's pairing, from this phone's database.
  useEffect(() => {
    const db = getDb();
    useObdStore.getState().setAdapter(db && vehicleId ? getAdapter(db, vehicleId) : null);
  }, [vehicleId]);

  useEffect(() => {
    const adapter = useObdStore.getState().adapter;
    if (!deviceId || !adapter) {
      return;
    }
    return runSession(adapter, fuel);
  }, [deviceId, fuel]);

  // Auto-start (Settings): the adapter going live means the car has been switched on.
  useEffect(
    () =>
      useObdStore.subscribe((next, prev) => {
        const recording = useRecordingStore.getState();
        if (next.link === 'live' && prev.link !== 'live' && usePreferencesStore.getState().obdAutoStart && recording.status === 'ready' && vehicle) {
          recording.start({id: vehicle.id, name: vehicle.display_name});
        }
      }),
    [vehicle],
  );
}
