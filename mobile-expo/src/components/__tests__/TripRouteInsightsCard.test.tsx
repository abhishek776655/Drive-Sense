import React from 'react';
import {View} from 'react-native';
import {render, screen} from '@testing-library/react-native';
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
});
