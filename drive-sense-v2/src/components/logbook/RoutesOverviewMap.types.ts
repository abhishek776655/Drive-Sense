import type {TripRoutePreview} from '../../services/tripService';

export interface RoutesOverviewMapProps {
  /** Newest first: the first route is drawn on top at full strength. */
  routes: TripRoutePreview[];
  interactive?: boolean;
  onOpenTrip: (tripId: string) => void;
  onExpand?: () => void;
}
