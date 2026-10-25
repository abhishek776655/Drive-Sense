import type {Corner} from './cornering';
import type {RoughSegment} from './roughness';

/** A finished drive's phone-sensor summary, kept on the phone like its OBD data. */
export type TripSensors = {
  corners: {count: number; hardest: Corner | null};
  road: {segments: RoughSegment[]; summary: {smooth: number; fair: number; rough: number} | null};
  phoneUseS: number;
};
