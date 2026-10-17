import React from 'react';
import {View} from 'react-native';
import {fireEvent, render, screen} from '@testing-library/react-native';
import {TripRouteInsightsCard} from '../TripRouteInsightsCard';
import type {MockTrip} from '../../mocks/trackingData';
import {getRouteSummary} from '../../utils/tripRoute';

const makeTrip = (): MockTrip => ({
  id: 'trip-1',
  title: 'Start',
  subtitle: 'End',
  date: 'May 16, 2026',
  distance: '10.0 km',
  duration: '20m',
  score: 88,
  coordinates: [],
  routePoints: [],
  startTime: '10:00 AM',
  endTime: '10:20 AM',
  category: 'Honda City',
  vehicleName: 'Honda City',
  vehicleId: 'vehicle-1',
  status: 'Completed',
  avgSpeed: '30 km/h',
  maxSpeed: '60 km/h',
  fuelConsumed: '0.8 L',
  mileage: '12.5 km/l',
  idleTime: '2m',
  stops: '0',
  drivingScore: 88,
  events: [],
  insights: [
    {
      rule_id: 'safety_overspeed',
      category: 'safety',
      tone: 'warning',
      title: 'Overspeeding detected',
      message: 'Keep speed below posted limits to reduce risk and improve trip consistency.',
      metric_label: 'Overspeed',
      metric_value: '2 events',
      priority: 100,
    },
  ],
});

describe('TripRouteInsightsCard', () => {
  it('renders backend-provided trip insight content', () => {
    render(
      <TripRouteInsightsCard
        trip={makeTrip()}
        summary={getRouteSummary([])}
        mapContent={<View testID="route-map" />}
      />
    );

    expect(screen.getByText('Trip Insights')).toBeTruthy();
    expect(screen.getByText('Overspeeding detected')).toBeTruthy();
    expect(screen.getByText('Keep speed below posted limits to reduce risk and improve trip consistency.')).toBeTruthy();
    expect(screen.getByText('2 events')).toBeTruthy();
    expect(screen.getAllByText('Overspeed').length).toBeGreaterThan(0);
  });

  it('shows the recorded top speed when the backend has one', () => {
    render(
      <TripRouteInsightsCard
        trip={makeTrip()}
        summary={getRouteSummary([])}
        mapContent={<View testID="route-map" />}
      />
    );

    expect(screen.getByText('Top Speed')).toBeTruthy();
    expect(screen.getByText('60 km/h')).toBeTruthy();
  });

  it('leads with the vehicle and opens it when tapped', () => {
    const onPressVehicle = jest.fn();
    render(
      <TripRouteInsightsCard
        trip={makeTrip()}
        summary={getRouteSummary([])}
        mapContent={<View testID="route-map" />}
        onPressVehicle={onPressVehicle}
      />
    );

    fireEvent.press(screen.getByLabelText('View Honda City'));

    expect(onPressVehicle).toHaveBeenCalledTimes(1);
  });

  it('still names the vehicle when it cannot be opened', () => {
    render(
      <TripRouteInsightsCard
        trip={{...makeTrip(), vehicleId: undefined}}
        summary={getRouteSummary([])}
        mapContent={<View testID="route-map" />}
      />
    );

    expect(screen.getByText('Honda City')).toBeTruthy();
    expect(screen.queryByLabelText('View Honda City')).toBeNull();
  });

  it('renders both endpoint addresses', () => {
    render(
      <TripRouteInsightsCard
        trip={{...makeTrip(), title: 'Indiranagar, Bengaluru', subtitle: 'Koramangala, Bengaluru'}}
        summary={getRouteSummary([])}
        mapContent={<View testID="route-map" />}
      />
    );

    expect(screen.getByText('Indiranagar, Bengaluru')).toBeTruthy();
    expect(screen.getByText('Koramangala, Bengaluru')).toBeTruthy();
    expect(screen.getByText('Start')).toBeTruthy();
    expect(screen.getByText('End')).toBeTruthy();
  });

  it('falls back to the route-derived peak when no top speed was recorded', () => {
    const routePoints = [
      {latitude: 12.9716, longitude: 77.5946, recorded_at: '2026-05-16T10:00:00Z'},
      {latitude: 12.9816, longitude: 77.5946, recorded_at: '2026-05-16T10:01:00Z'},
    ];

    render(
      <TripRouteInsightsCard
        trip={{...makeTrip(), maxSpeed: null, routePoints}}
        summary={getRouteSummary(routePoints)}
        mapContent={<View testID="route-map" />}
      />
    );

    expect(screen.getByText('Top Speed')).toBeTruthy();
    expect(screen.queryByText('60 km/h')).toBeNull();
  });
});
