import {PermissionsAndroid, Platform} from 'react-native';
import {BleManager, State, type Characteristic, type Device, type Subscription} from 'react-native-ble-plx';
import type {Transport} from './pollLoop';

/** Serial-over-BLE services ELM327 adapters use (Vgate/clones FFF0 and FFE0, OBDLink 18F0). */
const SERVICES = ['fff0', 'ffe0', '18f0'];
/** Clones often advertise no service at all; their names give them away. */
const ADAPTER_NAME = /obd|elm|v-?link|vgate|icar|veepeak|konnwei|carista|obdii/i;
/** iOS state restoration: lets the system relaunch the app when the paired adapter powers up. */
const RESTORE_ID = 'drivesense-obd';

export type BleStatus = 'on' | 'off' | 'unauthorized' | 'unsupported' | 'unknown';

export interface FoundAdapter {
  id: string;
  name: string;
}

export interface AdapterLink extends Transport {
  id: string;
  name: string;
  disconnect: () => Promise<void>;
  onDisconnect: (cb: () => void) => () => void;
}

let manager: BleManager | null = null;
const ble = () => (manager ??= new BleManager({restoreStateIdentifier: RESTORE_ID, restoreStateFunction: () => undefined}));

const short = (uuid: string) => {
  const u = uuid.toLowerCase();
  return u.length > 8 ? u.slice(4, 8) : u;
};

const toStatus = (state: State): BleStatus => {
  switch (state) {
    case State.PoweredOn:
      return 'on';
    case State.PoweredOff:
    case State.Resetting:
      return 'off';
    case State.Unauthorized:
      return 'unauthorized';
    case State.Unsupported:
      return 'unsupported';
    default:
      return 'unknown';
  }
};

/** Android 12+: scan and connect need run-time permissions. */
export const ensureBlePermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return true;
  }
  if (Platform.Version < 31) {
    const fine = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    return fine === PermissionsAndroid.RESULTS.GRANTED;
  }
  const result = await PermissionsAndroid.requestMultiple([PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]);
  return Object.values(result).every((r) => r === PermissionsAndroid.RESULTS.GRANTED);
};

export const bleStatus = async (): Promise<BleStatus> => toStatus(await ble().state());

export const onBleStatus = (cb: (status: BleStatus) => void): (() => void) => {
  const sub = ble().onStateChange((state) => cb(toStatus(state)), true);
  return () => sub.remove();
};

/** Lists nearby adapters until the returned stop is called. */
export const scanAdapters = (onFound: (adapter: FoundAdapter) => void, onError: (message: string) => void): (() => void) => {
  const seen = new Set<string>();
  void ble().startDeviceScan(null, {allowDuplicates: false}, (error, device) => {
    if (error) {
      onError(error.message);
      return;
    }
    if (!device || seen.has(device.id)) {
      return;
    }
    const name = device.name ?? device.localName ?? '';
    const services = (device.serviceUUIDs ?? []).map(short);
    if (ADAPTER_NAME.test(name) || services.some((s) => SERVICES.includes(s))) {
      seen.add(device.id);
      onFound({id: device.id, name: name || 'OBD adapter'});
    }
  });
  return () => void ble().stopDeviceScan();
};

const findPipe = async (device: Device): Promise<{write: Characteristic; notify: Characteristic}> => {
  const services = await device.services();
  for (const service of services.filter((s) => SERVICES.includes(short(s.uuid)))) {
    const chars = await service.characteristics();
    const write = chars.find((c) => c.isWritableWithoutResponse || c.isWritableWithResponse);
    const notify = chars.find((c) => c.isNotifiable || c.isIndicatable);
    if (write && notify) {
      return {write, notify};
    }
  }
  throw new Error('This device is not an OBD-II adapter.');
};

const encode = (text: string) => btoa(text);
const decode = (base64: string) => atob(base64);

/**
 * Connects to a paired adapter. On iOS this waits as long as it takes (the car may be off), which
 * is how the phone reconnects by itself when the car starts.
 */
export const connectAdapter = async (id: string): Promise<AdapterLink> => {
  const device = await ble().connectToDevice(id, {autoConnect: Platform.OS === 'android'});
  await device.discoverAllServicesAndCharacteristics();
  const {write, notify} = await findPipe(device);
  const listeners = new Set<(chunk: string) => void>();
  const monitor: Subscription = notify.monitor((error, c) => {
    if (!error && c?.value) {
      const chunk = decode(c.value);
      listeners.forEach((l) => l(chunk));
    }
  });
  const withoutResponse = write.isWritableWithoutResponse;
  return {
    id,
    name: device.name ?? device.localName ?? 'OBD adapter',
    write: async (text) => {
      const value = encode(text);
      await (withoutResponse ? write.writeWithoutResponse(value) : write.writeWithResponse(value));
    },
    onData: (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    disconnect: async () => {
      monitor.remove();
      await ble().cancelDeviceConnection(id).catch(() => undefined);
    },
    onDisconnect: (cb) => {
      const sub = ble().onDeviceDisconnected(id, () => {
        monitor.remove();
        cb();
      });
      return () => sub.remove();
    },
  };
};

/** Gives up a pending connect (the car never came on) or an open one. */
export const cancelConnect = async (id: string) => {
  await ble().cancelDeviceConnection(id).catch(() => undefined);
};
