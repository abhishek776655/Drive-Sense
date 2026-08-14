import * as Location from 'expo-location';
import {toLocationPayload} from '../backgroundLocationTask';

jest.mock('expo-task-manager', () => ({defineTask: jest.fn()}));
jest.mock('../tripService', () => ({tripService: {sendLocations: jest.fn()}}));

const sample = (coords: Partial<Location.LocationObject['coords']>): Location.LocationObject =>
  ({
    timestamp: Date.parse('2026-08-15T10:00:00.000Z'),
    coords: {
      latitude: 12.9716,
      longitude: 77.5946,
      altitude: 900,
      accuracy: 5,
      altitudeAccuracy: 3,
      heading: 90,
      speed: 12,
      ...coords,
    },
  }) as Location.LocationObject;

describe('toLocationPayload', () => {
  it('converts an OS sample to the ingest payload', () => {
    expect(toLocationPayload(sample({}))).toEqual({
      recorded_at: '2026-08-15T10:00:00.000Z',
      latitude: 12.9716,
      longitude: 77.5946,
      speed_mps: 12,
      heading_deg: 90,
      accuracy_m: 5,
      altitude_m: 900,
      is_moving: true,
      provider: 'background',
    });
  });

  it('treats the sentinel negative speed as stationary', () => {
    // iOS reports -1 for "unknown", which would otherwise be ingested as a negative speed and
    // violate the backend's non-negative check.
    expect(toLocationPayload(sample({speed: -1})).speed_mps).toBe(0);
  });

  it('drops a sentinel negative heading rather than storing it', () => {
    expect(toLocationPayload(sample({heading: -1})).heading_deg).toBeNull();
  });

  it('never reports a negative accuracy', () => {
    expect(toLocationPayload(sample({accuracy: -5})).accuracy_m).toBe(0);
  });

  it('handles a missing accuracy', () => {
    expect(toLocationPayload(sample({accuracy: null})).accuracy_m).toBe(0);
  });

  it('marks a crawling sample as not moving', () => {
    expect(toLocationPayload(sample({speed: 0.2})).is_moving).toBe(false);
  });

  it('passes a null altitude through', () => {
    expect(toLocationPayload(sample({altitude: null})).altitude_m).toBeNull();
  });
});
