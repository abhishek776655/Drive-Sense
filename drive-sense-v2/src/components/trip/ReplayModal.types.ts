import type {CleanPoint} from '../../utils/tripAnalysis';
import type {TripRouteMapProps} from './TripRouteMap.types';

/** A located driving event, with what the replay's detail card shows about it. */
export type ReplayEvent = TripRouteMapProps['events'][number] & {
  /** When it happened (epoch ms), to find the speed and G at that moment. */
  at?: number | null;
  /** How far over the limit (×), when the server measured it. */
  intensity?: number | null;
};

export interface ReplayModalProps {
  visible: boolean;
  onClose: () => void;
  points: CleanPoint[];
  events: ReplayEvent[];
}
