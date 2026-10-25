import type {CleanPoint} from '../../utils/tripAnalysis';
import type {ReplayEventKind} from './ReplayEvents';

export type LatLng = {latitude: number; longitude: number};

export interface TripRouteMapProps {
  points: CleanPoint[];
  /** Title / description show in the marker's callout when it is tapped. */
  events: (LatLng & {id: string; kind: ReplayEventKind; title?: string; description?: string; at?: number; intensity?: number | null; kmh?: number})[];
  /** Hide the event markers (the Events pill). Default shown. */
  showEvents?: boolean;
  /** Speed colours the route by speed; Plain draws it in the accent colour. Default Speed. */
  mode?: 'speed' | 'plain';
  /** Pan and zoom (full-screen map only). */
  interactive?: boolean;
  /** Centre here at street zoom instead of fitting the whole route. */
  focus?: LatLng | null;
  /** Where the speed legend sits; default top-left, clear of the map's legal label. */
  legendStyle?: {top?: number; bottom?: number; left?: number};
  /** Shows the expand button when set. */
  onExpand?: () => void;
  /** Rough stretches of road the phone felt (phone sensors), drawn as small amber / red spots. */
  roughSpots?: (LatLng & {level: 'fair' | 'rough'})[];
}
