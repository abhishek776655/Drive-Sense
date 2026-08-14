import {apiClient} from './apiClient';

interface TrendPoint {
  bucket_start: string;
  trip_count: number;
  distance_meters: number;
  avg_driving_score: number | null;
}

export type TrendGranularity = 'day' | 'week' | 'month';

interface TrendSeriesResponse {
  granularity: TrendGranularity;
  bucket_count: number;
  previous: TrendPoint[];
  current: TrendPoint[];
}

export interface TrendBucket {
  key: string;
  /** Axis label. Terse — it has one column's width to fit in. */
  label: string;
  /** Unambiguous label for the tooltip, where there is room to spell the bucket out. */
  detailLabel: string;
  distanceKm: number;
  tripCount: number;
  score: number | null;
}

export interface TrendView {
  granularity: TrendGranularity;
  buckets: TrendBucket[];
  /** Same-length, index-aligned distances from the preceding window. */
  previousKm: number[];
  subtitle: string;
  currentLabel: string;
  previousLabel: string;
  metricValue: string;
  metricLabel: string;
  metricDelta: string | null;
}

const GRANULARITY_NOUN: Record<TrendGranularity, string> = {
  day: 'days',
  week: 'weeks',
  month: 'months',
};

/**
 * `date_trunc('week'|'month', ...)` always lands on the same weekday or day-of-month, so a weekday
 * formatter collapses to "Mon Mon Mon...". Each granularity needs its own label shape.
 */
const formatBucketLabel = (bucketStart: string, granularity: TrendGranularity): string => {
  const date = new Date(bucketStart);
  if (granularity === 'day') {
    return date.toLocaleDateString('en-IN', {weekday: 'short'});
  }
  if (granularity === 'week') {
    return date.toLocaleDateString('en-IN', {day: 'numeric', month: 'short'});
  }
  return date.toLocaleDateString('en-IN', {month: 'short', year: '2-digit'});
};

const formatBucketDetailLabel = (bucketStart: string, granularity: TrendGranularity): string => {
  const date = new Date(bucketStart);
  if (granularity === 'day') {
    return date.toLocaleDateString('en-IN', {weekday: 'short', day: 'numeric', month: 'short'});
  }
  if (granularity === 'week') {
    return `Week of ${date.toLocaleDateString('en-IN', {day: 'numeric', month: 'short'})}`;
  }
  return date.toLocaleDateString('en-IN', {month: 'long', year: 'numeric'});
};

const sumDistanceKm = (points: TrendPoint[]): number =>
  points.reduce((total, point) => total + point.distance_meters, 0) / 1000;

export const transformTrendSeries = (data: TrendSeriesResponse): TrendView => {
  const currentTotal = sumDistanceKm(data.current);
  const previousTotal = sumDistanceKm(data.previous);
  const tripCount = data.current.reduce((total, point) => total + point.trip_count, 0);
  const noun = GRANULARITY_NOUN[data.granularity];
  const span = `${data.bucket_count} ${noun}`;

  // A percentage against a zero baseline is not a percentage. Suppress the chip instead of
  // rendering an infinite jump the first time a user drives in a window.
  const metricDelta =
    previousTotal > 0
      ? `${currentTotal >= previousTotal ? '+' : ''}${Math.round(((currentTotal - previousTotal) / previousTotal) * 100)}%`
      : null;

  return {
    granularity: data.granularity,
    buckets: data.current.map((point) => ({
      key: point.bucket_start,
      label: formatBucketLabel(point.bucket_start, data.granularity),
      detailLabel: formatBucketDetailLabel(point.bucket_start, data.granularity),
      // One decimal: rounding to whole kilometres turns every short errand into "0 km".
      distanceKm: Math.round(point.distance_meters / 100) / 10,
      tripCount: point.trip_count,
      score: point.avg_driving_score != null ? Math.round(point.avg_driving_score) : null,
    })),
    previousKm: data.previous.map((point) => Math.round(point.distance_meters / 100) / 10),
    subtitle: `Last ${span} vs prior ${span}`,
    currentLabel: 'Current',
    previousLabel: 'Previous',
    metricValue: `${Math.round(currentTotal)} km`,
    metricLabel: `${tripCount} ${tripCount === 1 ? 'trip' : 'trips'} in the last ${span}`,
    metricDelta,
  };
};

interface EventBreakdown {
  harsh_brake_count: number;
  rapid_acceleration_count: number;
  overspeed_count: number;
  total_events: number;
}

interface RecentTrip {
  trip_id: string;
  vehicle_id: string;
  vehicle_name: string;
  vehicle_image_url: string | null;
  state: string;
  start_time: string;
  end_time: string | null;
  distance_meters: number;
  duration_seconds: number;
  driving_score: number | null;
  avg_speed_mps: number | null;
  max_speed_mps: number | null;
  start_address: string | null;
  end_address: string | null;
  event_count: number;
}

interface VehicleSummary {
  vehicle_id: string;
  vehicle_name: string;
  vehicle_image_url: string | null;
  company_name: string;
  model_name: string;
  nickname: string | null;
  plate_number: string | null;
  fuel_type: string;
  mileage_baseline_km_per_l: number | null;
  trip_count: number;
  total_distance_meters: number;
  avg_driving_score: number | null;
  last_trip_at: string | null;
}

interface MetricSummary {
  total_vehicles: number;
  total_trips: number;
  active_trips: number;
  total_distance_meters: number;
  total_duration_seconds: number;
  total_fuel_used_liters: number;
  total_fuel_cost_amount: number;
  avg_driving_score: number | null;
}

interface RecentEvent {
  event_id: string;
  trip_id: string;
  vehicle_id: string;
  vehicle_name: string;
  vehicle_image_url: string | null;
  event_type: string;
  occurred_at: string;
  intensity: number | null;
}

export interface RecurringInsight {
  rule_id: string;
  category: string;
  tone: 'warning' | 'info' | 'success';
  title: string;
  message: string;
  metric_label: string;
  metric_value: string;
  priority: number;
}

export interface DashboardResponse {
  summary: MetricSummary;
  week_summary?: MetricSummary;
  today_summary?: MetricSummary;
  trend: TrendPoint[];
  events: EventBreakdown;
  vehicles: VehicleSummary[];
  recent_trips: RecentTrip[];
  recent_events?: RecentEvent[];
}

export interface TransformedDashboard {
  /** `null` until at least one trip has been scored. Never faked as 0 — a real 0 means bad driving. */
  score: number | null;
  scoreDelta: number;
  stats: {
    totalDistance: number;
    totalTrips: number;
    avgSpeed: number;
    totalDurationSeconds: number;
    activeTrips: number;
    fuelUsedLiters: number;
    fuelCostAmount: number;
  };
  weekStats: {
    totalDistance: number;
    totalTrips: number;
    avgSpeed: number;
    totalDurationSeconds: number;
    activeTrips: number;
    fuelUsedLiters: number;
    fuelCostAmount: number;
  };
  todayStats: {
    totalDistance: number;
    totalTrips: number;
    avgSpeed: number;
    totalDurationSeconds: number;
    activeTrips: number;
    fuelUsedLiters: number;
    fuelCostAmount: number;
  };
  events: {
    harshBrakeCount: number;
    rapidAccelerationCount: number;
    overspeedCount: number;
    totalEvents: number;
  };
  trendView: TrendView;
  recentTrips: Array<{
    id: string;
    distance: number;
    duration: number;
    score: number;
    eventCount: number;
    vehicleName: string;
    vehicleImageUrl: string | null;
    startAddress?: string;
    endAddress?: string;
    state: string;
    avgSpeedKph: number;
    topSpeedKph: number | null;
    startedAt: string;
    dateLabel: string;
    timeLabel: string;
  }>;
  recentEvents: Array<{
    id: string;
    tripId: string;
    vehicleName: string;
    vehicleImageUrl: string | null;
    eventType: string;
    occurredAt: string;
    timeLabel: string;
    intensity: number | null;
  }>;
  vehicles: Array<{
    id: string;
    name: string;
    imageUrl: string | null;
    companyName: string;
    modelName: string;
    nickname: string | null;
    plateNumber: string | null;
    fuelType: string;
    totalDistanceMeters: number;
    mileageBaselineKmPerL: number | null;
    lastTripAt: string | null;
    tripCount: number;
    avgScore: number;
  }>;
  activeVehicle: string;
  ongoingTrip: {
    id: string;
    vehicleName: string;
    startedAt: string;
    distance: number;
    duration: number;
    speed: number;
  } | null;
}

const transformDashboard = (data: DashboardResponse): TransformedDashboard => {
  const summary = data.summary;
  const weekSummary = data.week_summary ?? data.summary;
  const todaySummary = data.today_summary ?? data.week_summary ?? data.summary;
  const trend = data.trend;
  const events = data.events;

  // `/dashboard` ships the daily series as one flat, gap-filled list of two equal windows. Split it
  // down the middle rather than slicing a fixed 7, which used to count buckets instead of days and
  // silently reached further back whenever a day had no trips.
  const half = Math.floor(trend.length / 2);
  const previousWindow = trend.slice(0, half);
  const currentWindow = trend.slice(half);
  const trendView = transformTrendSeries({
    granularity: 'day',
    bucket_count: half,
    previous: previousWindow,
    current: currentWindow,
  });
  const averageScore = (values: TrendPoint[]) => {
    const valid = values.filter((item) => item.avg_driving_score != null);
    if (valid.length === 0) {
      return summary.avg_driving_score ?? 0;
    }
    return valid.reduce((total, item) => total + (item.avg_driving_score ?? 0), 0) / valid.length;
  };
  const previousAverageScore = averageScore(previousWindow);

  const recentTrips = [...data.recent_trips]
    .sort((left, right) => new Date(right.start_time).getTime() - new Date(left.start_time).getTime())
    .slice(0, 5)
    .map((t) => ({
      id: t.trip_id,
      distance: t.distance_meters,
      duration: t.duration_seconds,
      score: t.driving_score ?? 0,
      eventCount: t.event_count,
      vehicleName: t.vehicle_name,
      vehicleImageUrl: t.vehicle_image_url,
      startAddress: t.start_address ?? undefined,
      endAddress: t.end_address ?? undefined,
      state: t.state,
      // Falls back to distance/duration, which is what an average speed is anyway — unlike a top
      // speed, it can be reconstructed when the backend column is empty.
      avgSpeedKph:
        t.avg_speed_mps != null
          ? t.avg_speed_mps * 3.6
          : t.duration_seconds > 0
            ? (t.distance_meters / t.duration_seconds) * 3.6
            : 0,
      topSpeedKph: t.max_speed_mps != null ? t.max_speed_mps * 3.6 : null,
      startedAt: t.start_time,
      dateLabel: new Date(t.start_time).toLocaleDateString('en-IN', {month: 'short', day: 'numeric'}),
      timeLabel: new Date(t.start_time).toLocaleTimeString('en-IN', {
        hour: 'numeric',
        minute: '2-digit',
      }),
    }));

  const activeTripData = data.recent_trips.find((t) => t.state === 'active' || t.state === 'started');
  const ongoingTrip = activeTripData
    ? {
        id: activeTripData.trip_id,
        vehicleName: activeTripData.vehicle_name,
        startedAt: new Date(activeTripData.start_time).toLocaleTimeString('en-IN', {
          hour: 'numeric',
          minute: '2-digit',
        }),
        distance: activeTripData.distance_meters,
        duration: activeTripData.duration_seconds,
        speed: activeTripData.duration_seconds > 0 ? (activeTripData.distance_meters / activeTripData.duration_seconds) * 3.6 : 0,
      }
    : null;

  const activeVehicle =
    data.vehicles.length > 0 ? data.vehicles[0].vehicle_name : 'No Vehicle';

  return {
    score: summary.avg_driving_score != null ? Math.round(summary.avg_driving_score) : null,
    scoreDelta:
      summary.avg_driving_score != null ? Math.round(summary.avg_driving_score - previousAverageScore) : 0,
    stats: {
      totalDistance: summary.total_distance_meters,
      totalTrips: summary.total_trips,
      avgSpeed:
        summary.total_duration_seconds > 0
          ? (summary.total_distance_meters / summary.total_duration_seconds) * 3.6
          : 0,
      totalDurationSeconds: summary.total_duration_seconds,
      activeTrips: summary.active_trips,
      fuelUsedLiters: summary.total_fuel_used_liters,
      fuelCostAmount: summary.total_fuel_cost_amount,
    },
    weekStats: {
      totalDistance: weekSummary.total_distance_meters,
      totalTrips: weekSummary.total_trips,
      avgSpeed:
        weekSummary.total_duration_seconds > 0
          ? (weekSummary.total_distance_meters / weekSummary.total_duration_seconds) * 3.6
          : 0,
      totalDurationSeconds: weekSummary.total_duration_seconds,
      activeTrips: weekSummary.active_trips,
      fuelUsedLiters: weekSummary.total_fuel_used_liters,
      fuelCostAmount: weekSummary.total_fuel_cost_amount,
    },
    todayStats: {
      totalDistance: todaySummary.total_distance_meters,
      totalTrips: todaySummary.total_trips,
      avgSpeed:
        todaySummary.total_duration_seconds > 0
          ? (todaySummary.total_distance_meters / todaySummary.total_duration_seconds) * 3.6
          : 0,
      totalDurationSeconds: todaySummary.total_duration_seconds,
      activeTrips: todaySummary.active_trips,
      fuelUsedLiters: todaySummary.total_fuel_used_liters,
      fuelCostAmount: todaySummary.total_fuel_cost_amount,
    },
    events: {
      harshBrakeCount: events.harsh_brake_count,
      rapidAccelerationCount: events.rapid_acceleration_count,
      overspeedCount: events.overspeed_count,
      totalEvents: events.total_events,
    },
    trendView,
    recentTrips,
    recentEvents: (data.recent_events ?? []).map((event) => ({
      id: event.event_id,
      tripId: event.trip_id,
      vehicleName: event.vehicle_name,
      vehicleImageUrl: event.vehicle_image_url,
      eventType: event.event_type,
      occurredAt: event.occurred_at,
      timeLabel: new Date(event.occurred_at).toLocaleTimeString('en-IN', {
        hour: 'numeric',
        minute: '2-digit',
      }),
      intensity: event.intensity,
    })),
    vehicles: data.vehicles.map((vehicle) => ({
      id: vehicle.vehicle_id,
      name: vehicle.vehicle_name,
      imageUrl: vehicle.vehicle_image_url,
      companyName: vehicle.company_name,
      modelName: vehicle.model_name,
      nickname: vehicle.nickname,
      plateNumber: vehicle.plate_number,
      fuelType: vehicle.fuel_type,
      totalDistanceMeters: vehicle.total_distance_meters,
      mileageBaselineKmPerL: vehicle.mileage_baseline_km_per_l,
      lastTripAt: vehicle.last_trip_at,
      tripCount: vehicle.trip_count,
      avgScore: Math.round(vehicle.avg_driving_score ?? 0),
    })),
    activeVehicle,
    ongoingTrip,
  };
};

export const dashboardService = {
  getDashboard: async (): Promise<TransformedDashboard> => {
    const response = await apiClient.get<DashboardResponse>('/api/v1/dashboard');
    return transformDashboard(response.data);
  },
  getTrend: async (granularity: TrendGranularity): Promise<TrendView> => {
    const response = await apiClient.get<TrendSeriesResponse>('/api/v1/dashboard/trend', {
      params: {granularity},
    });
    return transformTrendSeries(response.data);
  },
  getRecurringInsights: async (): Promise<RecurringInsight[]> => {
    const response = await apiClient.get<RecurringInsight[]>('/api/v1/dashboard/insights');
    return response.data;
  },
};
