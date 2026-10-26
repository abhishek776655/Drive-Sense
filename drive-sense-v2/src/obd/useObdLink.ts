import {useEffect} from 'react';
import {getDb} from '../db';
import {getAdapter, putAdapter, type AdapterState, type ObdAdapter} from '../db/obdRepos';
import {useObdStore, type ObdLink} from '../stores/obdStore';
import {usePreferencesStore} from '../stores/preferencesStore';
import {useRecordingStore} from '../stores/recordingStore';
import {useActiveVehicle} from '../stores/vehicleStore';
import type {FuelType} from '../services/vehicleService';
import {logBle} from './bleLog';
import {bleStatus, cancelConnect, connectAdapter, onBleStatus, type AdapterLink, type BleStatus} from './bleTransport';
import {BatteryWatch} from './battery';
import {AccelEstimator, boostKpa, economyL100, fuelFlowLph, GearEstimator, powerKw, torqueNm} from './derive';
import {createPollLoop} from './pollLoop';
import {createSimAdapter, SIM_DEVICE_ID} from './simAdapter';
import {engineEndAt} from './sourceRules';

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
const saveLastState = (paired: ObdAdapter, battery?: AdapterState['battery']) => {
  const db = getDb();
  const s = useObdStore.getState();
  if (!db) {
    return;
  }
  // The store's copy is newer than the one the session started with (it holds earlier saves).
  const adapter = s.adapter?.deviceId === paired.deviceId ? s.adapter : paired;
  const values = s.values;
  const next: ObdAdapter = {
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
      // A quick restart (auto start-stop) has no resting figure: keep the last real one.
      battery: battery ? {...battery, restingV: battery.restingV ?? adapter.lastState?.battery?.restingV ?? null} : adapter.lastState?.battery,
      odometerKm: values.odometer?.v ?? adapter.lastState?.odometerKm ?? null,
      odometerAt: values.odometer ? new Date(values.odometer.at).toISOString() : (adapter.lastState?.odometerAt ?? null),
    },
  };
  putAdapter(db, next);
  // Same device, so the live session carries on; the "last seen" card gets the fresh state.
  s.setAdapter(next);
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
  const accel = new AccelEstimator();
  let latestAccel: number | null = null;
  // The car's own gear byte layout is unconfirmed on real cars: log the first one to compare.
  let gearLogged = false;
  // Resting voltage and the dip at each engine start, kept with the paired adapter (battery health).
  const battery = new BatteryWatch((r) =>
    saveLastState(adapter, {restingV: r.restingV, startDipV: r.startDipV, at: new Date(r.at).toISOString()}),
  );

  const derive = () => {
    const v = store().values;
    const flow = fuelFlowLph({fuelRate: v.fuelRate?.v, fuelRateGs: v.fuelRateGs?.v, maf: v.maf?.v}, fuel);
    const torque = torqueNm(v.torquePct?.v, v.torqueRef?.v);
    // The car's own gear when it reports one (−1: it says it doesn't), else the RPM ÷ speed guess.
    const carGear = v.gearCar?.v;
    store().setDerived({
      fuelFlow: flow,
      economy: economyL100(flow, v.speed?.v ?? null),
      boost: boostKpa(v.map?.v, v.baro?.v),
      gear: carGear != null && carGear >= 0 ? carGear : v.speed?.v === 0 ? 0 : gear.add(v.rpm?.v, v.speed?.v),
      torqueNm: torque,
      powerKw: powerKw(torque, v.rpm?.v),
      accelMps2: latestAccel,
    });
  };

  // Development builds: the pretend adapter needs no Bluetooth (spec 2026-10-25, simulator).
  const simulated = __DEV__ && adapter.deviceId === SIM_DEVICE_ID;

  const loopOnce = async () => {
    const status = simulated ? 'on' : await bleStatus();
    if (status !== 'on') {
      store().setLink(linkFor(status));
      await waitForBluetooth();
      return;
    }
    if (store().link !== 'live' && store().link !== 'engineOff') {
      store().setLink('waiting');
    }
    link = simulated ? createSimAdapter() : await connectAdapter(adapter.deviceId);
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
        if (key === 'speed') {
          latestAccel = accel.add(value, at);
        } else if (key === 'gearCar' && !gearLogged) {
          gearLogged = true;
          void logBle(`Car gear (A4): ${value}`);
        } else if (key === 'odometer') {
          // Kept with the paired adapter, so Garage shows it with the car off.
          saveLastState(adapter);
        }
        if (key === 'voltage') {
          battery.voltage(value, at);
        } else if (key === 'rpm') {
          battery.rpm(value, at);
        }
        // Not on RPM: each call also feeds the gear estimator, which counts readings. Power follows
        // speed and torque readings, with the latest RPM.
        if (key === 'speed' || key === 'maf' || key === 'fuelRate' || key === 'fuelRateGs' || key === 'torquePct') {
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
      onSupportedCodes: (codes) => void logBle(`Car answers PIDs: ${codes.join(' ') || 'none'}`),
      onVin: (vin) => store().setVin(vin),
      onCodes: (codes) => store().setCodes(codes),
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
    void (link ? link.disconnect() : simulated ? undefined : cancelConnect(adapter.deviceId));
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

  // Drive end with the adapter (spec 2026-10-25, telemetry sources): once the engine has been off
  // (RPM 0 or ignition off) for the Auto-stop time. Driven by adapter and recording updates, which
  // keep coming in the background; the tick is a foreground backup. Auto-paused drives end the same way.
  useEffect(() => {
    const check = () => {
      const rec = useRecordingStore.getState();
      const prefs = usePreferencesStore.getState();
      const live = rec.status === 'recording' || (rec.status === 'paused' && rec.autoPaused);
      if (!live || rec.startedAt == null || !prefs.autoStop) {
        return;
      }
      const endAt = engineEndAt({
        engineOnAt: useObdStore.getState().engineOnAt,
        startedAt: rec.startedAt,
        now: Date.now(),
        lastMovementAt: rec.lastMovementAt,
        idleS: prefs.autoStopMinutes * 60,
      });
      if (endAt != null) {
        rec.end(endAt, true);
      }
    };
    const stopObd = useObdStore.subscribe(check);
    const stopRec = useRecordingStore.subscribe(check);
    const tick = setInterval(check, 5000);
    return () => {
      stopObd();
      stopRec();
      clearInterval(tick);
    };
  }, []);

  // Auto-start (Settings): the adapter going live means the car has been switched on.
  useEffect(
    () =>
      useObdStore.subscribe((next, prev) => {
        const recording = useRecordingStore.getState();
        if (next.link === 'live' && prev.link !== 'live' && usePreferencesStore.getState().obdAutoStart && recording.status === 'ready' && vehicle) {
          void logBle('Adapter live: starting the drive');
          recording.start({id: vehicle.id, name: vehicle.display_name});
        }
      }),
    [vehicle],
  );
}
