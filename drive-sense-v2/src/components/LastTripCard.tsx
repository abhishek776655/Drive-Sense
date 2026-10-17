import {router} from 'expo-router';
import type {LastTrip} from '../services/homeService';
import type {TripSummary} from '../services/tripService';
import {TripRow} from './logbook/TripRow';

/** Home's last trip in the shape of a Logbook row (fields the row does not show are left neutral). */
export const asTripSummary = (trip: LastTrip): TripSummary => ({
  id: trip.id,
  vehicle_name: trip.vehicleName,
  state: 'ended',
  start_time: trip.startTime,
  end_time: null,
  distance_meters: trip.distanceMeters,
  duration_seconds: trip.durationSeconds,
  driving_score: null,
  max_speed_mps: trip.maxSpeedMps,
  start_address: trip.startAddress,
  end_address: trip.endAddress,
  event_count: 0,
});

/** The Home "Last trip" card: the same row as the Logbook, opening the drive. */
export function LastTripCard({trip}: {trip: LastTrip}) {
  return <TripRow trip={asTripSummary(trip)} selecting={false} selected={false} onPress={() => router.push(`/trip/${trip.id}`)} />;
}
