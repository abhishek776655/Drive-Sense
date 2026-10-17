import type {CleanPoint} from '../../utils/tripAnalysis';
import type {TripRouteMapProps} from './TripRouteMap.types';

export interface ReplayModalProps {
  visible: boolean;
  onClose: () => void;
  points: CleanPoint[];
  events: TripRouteMapProps['events'];
}
