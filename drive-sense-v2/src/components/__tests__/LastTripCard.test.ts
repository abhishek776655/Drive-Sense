import {asTripSummary} from '../LastTripCard';

jest.mock('expo-router', () => ({router: {push: jest.fn()}}));

describe('asTripSummary', () => {
  it('carries what the Logbook row shows', () => {
    const summary = asTripSummary({
      id: 't1',
      vehicleName: 'Swift',
      startTime: '2026-10-16T10:10:00Z',
      startAddress: 'Sadar Bazar, Gurgaon',
      endAddress: 'Kotak Bank, Gurgaon',
      distanceMeters: 7500,
      durationSeconds: 2520,
      maxSpeedMps: 25,
    });
    expect(summary).toMatchObject({id: 't1', start_time: '2026-10-16T10:10:00Z', distance_meters: 7500, duration_seconds: 2520, max_speed_mps: 25, end_address: 'Kotak Bank, Gurgaon'});
  });
});
