import {create} from 'zustand';
import {EMPTY_CORNERS, stepCorner, type CornerState} from '../tracking/sensors/cornering';
import {addSeconds} from '../tracking/sensors/phoneUse';
import {EMPTY_ROUGH, roadSummary, stepRough, type RoughState} from '../tracking/sensors/roughness';
import type {TripSensors} from '../tracking/sensors/types';

type Where = {latitude: number; longitude: number} | null;

interface SensorDriveState {
  corners: CornerState;
  rough: RoughState;
  phoneUseS: number;
  addLateralG: (g: number, at: number, where: Where) => void;
  addVertical: (vertical: number, distanceM: number, where: Where) => void;
  addPhoneUse: (fromMs: number, toMs: number) => void;
  /** The drive so far as it is saved; null when nothing was measured. */
  summary: () => TripSensors | null;
  reset: () => void;
}

const EMPTY = {corners: EMPTY_CORNERS, rough: EMPTY_ROUGH, phoneUseS: 0};

/**
 * The drive in progress, as the phone's sensors see it (spec 2026-10-25, telemetry sources,
 * section 3): corners, road roughness and phone use, fed by the motion and phone-use feeds and saved
 * with the drive at its end (and snapshotted while it runs by `sensorRecorder`).
 */
export const useSensorDriveStore = create<SensorDriveState>((set, get) => ({
  ...EMPTY,
  addLateralG: (g, at, where) => set({corners: stepCorner(get().corners, g, at, where)}),
  addVertical: (vertical, distanceM, where) => set({rough: stepRough(get().rough, vertical, distanceM, where)}),
  addPhoneUse: (fromMs, toMs) => set({phoneUseS: addSeconds(get().phoneUseS, fromMs, toMs)}),
  summary: () => {
    const {corners, rough, phoneUseS} = get();
    if (corners.count === 0 && rough.segments.length === 0 && phoneUseS < 1) {
      return null;
    }
    return {
      corners: {count: corners.count, hardest: corners.hardest},
      road: {segments: rough.segments, summary: roadSummary(rough.segments)},
      phoneUseS: Math.round(phoneUseS),
    };
  },
  reset: () => set(EMPTY),
}));
