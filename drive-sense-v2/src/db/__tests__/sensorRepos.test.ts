import {memoryDb} from '../../testUtils/memoryDb';
import {migrate} from '../schema';
import {deleteTripSensors, putTripSensors, tripSensors} from '../sensorRepos';

const T0 = 1_760_000_000_000;
const value = {corners: {count: 3, hardest: {peakG: 0.4, at: T0 + 5000, latitude: 1, longitude: 2}}, road: {segments: [], summary: null}, phoneUseS: 42};

describe('trip sensors storage', () => {
  it('stores a drive’s summary by start time and finds it within two seconds', () => {
    const db = memoryDb();
    migrate(db);
    putTripSensors(db, T0 + 0.6, value);
    expect(tripSensors(db, T0 + 1500)).toEqual(value);
    expect(tripSensors(db, T0 + 5000)).toBeNull();
    deleteTripSensors(db, T0);
    expect(tripSensors(db, T0)).toBeNull();
  });
});
