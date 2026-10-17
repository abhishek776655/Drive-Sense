import {migrate, MIGRATIONS, schemaVersion} from '../schema';
import {
  cacheGet,
  cachePut,
  deleteTrips,
  getDetail,
  listTrips,
  listVehicles,
  putDetail,
  replaceVehicles,
  routePreviews,
  thinRoute,
  tripsMissingRoutes,
  upsertTrips,
  upsertVehicles,
  type SyncTrip,
} from '../repos';
import type {TripDetail} from '../../services/tripService';
import type {Vehicle} from '../../services/vehicleService';
import {memoryDb} from '../../testUtils/memoryDb';

const trip = (id: string, patch: Partial<SyncTrip> = {}): SyncTrip => ({
  id,
  vehicle_id: 'v1',
  vehicle_name: 'Old name',
  state: 'ended',
  start_time: '2026-10-10T08:00:00.000Z',
  end_time: '2026-10-10T08:30:00.000Z',
  distance_meters: 10_000,
  duration_seconds: 1800,
  driving_score: 80,
  max_speed_mps: 20,
  start_address: 'Office, Sector 5',
  end_address: 'Home, Dwarka',
  event_count: 1,
  updated_at: '2026-10-10T09:00:00.000Z',
  ...patch,
});

const vehicle = (id: string, name: string): Vehicle =>
  ({id, display_name: name, company_name: 'Skoda', model_name: 'Octavia', fuel_type: 'petrol', vehicle_type: 'car'}) as Vehicle;

const detail = (id: string, points = 3): TripDetail =>
  ({id, location_points: Array.from({length: points}, (_, i) => ({recorded_at: '', latitude: 28 + i / 1000, longitude: 77 + i / 1000, speed_mps: 10, altitude_m: null}))}) as TripDetail;

const setup = () => {
  const db = memoryDb();
  migrate(db);
  return db;
};

describe('local schema', () => {
  it('migrates a fresh database to the latest version, and again is a no-op', () => {
    const db = setup();
    expect(schemaVersion(db)).toBe(MIGRATIONS.length);
    migrate(db);
    expect(schemaVersion(db)).toBe(MIGRATIONS.length);
  });
});

describe('trips', () => {
  it('filters, sorts, pages and totals like the server', () => {
    const db = setup();
    upsertTrips(db, [
      trip('a', {start_time: '2026-10-01T08:00:00.000Z', distance_meters: 5000, driving_score: 95, max_speed_mps: 30}),
      trip('b', {start_time: '2026-10-05T08:00:00.000Z', distance_meters: 20_000, driving_score: 60, vehicle_id: 'v2', end_address: 'Airport'}),
      trip('c', {start_time: '2026-10-09T08:00:00.000Z', driving_score: null}),
    ]);
    const all = listTrips(db, {});
    expect(all.items.map((t) => t.id)).toEqual(['c', 'b', 'a']);
    expect(all.totals).toEqual({count: 3, distance_meters: 35_000, duration_seconds: 5400, max_speed_mps: 30});
    expect(listTrips(db, {sort: 'longest'}).items[0].id).toBe('b');
    expect(listTrips(db, {sort: 'best'}).items.map((t) => t.id)).toEqual(['a', 'b', 'c']);
    expect(listTrips(db, {minScore: 70}).items.map((t) => t.id)).toEqual(['a']);
    expect(listTrips(db, {vehicleId: 'v2'}).total).toBe(1);
    expect(listTrips(db, {search: 'AIRPORT'}).items.map((t) => t.id)).toEqual(['b']);
    expect(listTrips(db, {search: '100%'}).total).toBe(0);
    expect(listTrips(db, {from: '2026-10-04T00:00:00.000Z'}).total).toBe(2);
    expect(listTrips(db, {limit: 1, offset: 1}).items.map((t) => t.id)).toEqual(['b']);
  });

  it('shows the current vehicle name, not the one the trip was synced with', () => {
    const db = setup();
    upsertVehicles(db, [vehicle('v1', 'Skoda Octavia')]);
    upsertTrips(db, [trip('a')]);
    expect(listTrips(db, {}).items[0].vehicle_name).toBe('Skoda Octavia');
  });

  it('re-downloads the route of a trip the server changed', () => {
    const db = setup();
    upsertTrips(db, [trip('a')]);
    putDetail(db, detail('a'));
    expect(tripsMissingRoutes(db, 10)).toEqual([]);
    upsertTrips(db, [trip('a')]); // same version: nothing to do
    expect(getDetail(db, 'a')).not.toBeNull();
    upsertTrips(db, [trip('a', {updated_at: '2026-10-11T00:00:00.000Z'})]);
    expect(getDetail(db, 'a')).toBeNull();
    expect(tripsMissingRoutes(db, 10)).toEqual(['a']);
  });

  it('deletes a trip together with its route', () => {
    const db = setup();
    upsertTrips(db, [trip('a')]);
    putDetail(db, detail('a'));
    deleteTrips(db, ['a']);
    expect(listTrips(db, {}).total).toBe(0);
    expect(getDetail(db, 'a')).toBeNull();
  });
});

describe('routes', () => {
  it('thins long routes but keeps both ends', () => {
    const points = detail('a', 1000).location_points;
    const thin = thinRoute(points, 120);
    expect(thin).toHaveLength(120);
    expect(thin[0]).toEqual([points[0].latitude, points[0].longitude]);
    expect(thin.at(-1)).toEqual([points[999].latitude, points[999].longitude]);
  });

  it('says whether every drive in the window already has its route', () => {
    const db = setup();
    upsertTrips(db, [trip('a'), trip('b', {start_time: '2026-10-11T08:00:00.000Z', vehicle_id: 'v2'})]);
    putDetail(db, detail('a'));
    expect(routePreviews(db, {})).toMatchObject({complete: false});
    expect(routePreviews(db, {vehicleId: 'v1'}).complete).toBe(true);
    expect(routePreviews(db, {vehicleId: 'v1'}).routes[0].points).toHaveLength(3);
  });
});

describe('vehicles and cache', () => {
  it('replaces the vehicle list with the server one', () => {
    const db = setup();
    upsertVehicles(db, [vehicle('v1', 'A'), vehicle('v2', 'B')]);
    replaceVehicles(db, [vehicle('v2', 'B2')]);
    expect(listVehicles(db).map((v) => v.display_name)).toEqual(['B2']);
  });

  it('keeps the last API answer per key', () => {
    const db = setup();
    cachePut(db, 'home', {n: 1});
    cachePut(db, 'home', {n: 2});
    expect(cacheGet(db, 'home')).toEqual({n: 2});
    expect(cacheGet(db, 'nope')).toBeNull();
  });
});
