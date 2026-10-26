import {getDb} from '../db';
import {listAdapters} from '../db/obdRepos';
import {startBle} from './bleTransport';
import {SIM_DEVICE_ID} from './simAdapter';

/**
 * Imported at app start, like the background-location task: with an adapter paired, the Bluetooth
 * manager is created before any screen mounts, so an iOS relaunch for the adapter is picked up.
 * Without one it stays off, so nobody is asked for Bluetooth before they pair.
 */
try {
  const db = getDb();
  if (db && listAdapters(db).some((a) => a.deviceId !== SIM_DEVICE_ID)) {
    startBle();
  }
} catch (error) {
  console.warn('[ble] could not start at launch', error);
}
