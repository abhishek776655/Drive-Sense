import type {Transport} from './pollLoop';

/** Web has no Bluetooth LE here: the Telemetry tab shows the "not available" state. */
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

export const ensureBlePermission = async () => false;
export const bleStatus = async (): Promise<BleStatus> => 'unsupported';
export const onBleStatus = (cb: (status: BleStatus) => void) => {
  cb('unsupported');
  return () => {};
};
export const scanAdapters = (_onFound: (a: FoundAdapter) => void, onError: (message: string) => void) => {
  onError('Bluetooth is not available here.');
  return () => {};
};
export const connectAdapter = async (_id: string): Promise<AdapterLink> => {
  throw new Error('Bluetooth is not available here.');
};
export const cancelConnect = async (_id: string) => {};
