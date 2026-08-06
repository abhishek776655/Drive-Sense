import {apiClient} from './apiClient';

interface TrendPoint {
  bucket_start: string;
  trip_count: number;
  distance_meters: number;
  avg_driving_score: number | null;
}

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
  score: number;
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
  trend: {
    current: number[];
    previous: number[];
    labels: string[];
  };
  insights: Array<{type: 'warning' | 'info' | 'success'; message: string}>;
  recentTrips: Array<{
    id: string;
    distance: number;
    duration: number;
    score: number;
    eventCount: number;
    vehicleName: string;
    vehicleImageUrl: string | null;
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

  const currentWindow = trend.slice(-7);
  const previousWindow = trend.slice(-14, -7);
  const currentData = currentWindow.map((t) => Math.round(t.distance_meters / 1000));
  const previousData = previousWindow.map((t) => Math.round(t.distance_meters / 1000));
  const labels = trend.slice(-7).map((t) => {
    const date = new Date(t.bucket_start);
    return date.toLocaleDateString('en', {weekday: 'short'});
  });
  const averageScore = (values: TrendPoint[]) => {
    const valid = values.filter((item) => item.avg_driving_score != null);
    if (valid.length === 0) {
      return summary.avg_driving_score ?? 0;
    }
    return valid.reduce((total, item) => total + (item.avg_driving_score ?? 0), 0) / valid.length;
  };
  const previousAverageScore = averageScore(previousWindow);

  const insights: Array<{type: 'warning' | 'info' | 'success'; message: string}> = [];

  if (events.harsh_brake_count > 5) {
    insights.push({
      type: 'warning',
      message: `You had ${events.harsh_brake_count} harsh brake events this week`,
    });
  }

  if (events.rapid_acceleration_count > 5) {
    insights.push({
      type: 'warning',
      message: 'Reduce rapid acceleration for better fuel efficiency',
    });
  }

  if (events.overspeed_count > 0) {
    insights.push({
      type: 'warning',
      message: `${events.overspeed_count} overspeed events detected`,
    });
  }

  if (summary.avg_driving_score && summary.avg_driving_score >= 80) {
    insights.push({
      type: 'success',
      message: 'Great driving! Keep up the good work',
    });
  } else {
    insights.push({
      type: 'info',
      message: 'Drive smoothly to improve your score',
    });
  }

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
    score: Math.round(summary.avg_driving_score ?? 0),
    scoreDelta: Math.round((summary.avg_driving_score ?? 0) - previousAverageScore),
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
    trend: {
      current: currentData.length ? currentData : [0, 0, 0, 0, 0, 0, 0],
      previous: previousData.length ? previousData : [0, 0, 0, 0, 0, 0, 0],
      labels: labels.length ? labels : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    },
    insights,
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
};
