import {migrate} from '../../db/schema';
import {getDetail, listTrips, listVehicles, metaGet, putDetail, upsertTrips, type SyncTrip} from '../../db/repos';
import {memoryDb} from '../../testUtils/memoryDb';
import {backfillRoutes} from '../backfill';
import {CURSOR_KEY, hasSynced, pullAll, type SyncPage} from '../pull';
import type {TripDetail} from '../../services/tripService';

const trip = (id: string): SyncTrip =>
  ({id, vehicle_id: 'v1', vehicle_name: 'Car', state: 'ended', start_time: `2026-10-0${id.length}T08:00:00.000Z`, end_time: null, distance_meters: 1000, duration_seconds: 60, driving_score: 90, max_speed_mps: 10, start_address: null, end_address: null, event_count: 0, updated_at: '2026-10-10T00:00:00.000Z'}) as SyncTrip;

const page = (patch: Partial<SyncPage>): SyncPage => ({vehicles: [], deleted_vehicles: [], trips: [], deleted_trips: [], cursor: null, has_more: false, ...patch});

const setup = () => {
  const db = memoryDb();
  migrate(db);
  return db;
};

describe('pull', () => {
  it('follows pages until there are no more, saving the cursor', async () => {
    const db = setup();
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(page({trips: [trip('a')], vehicles: [{id: 'v1', display_name: 'Car'} as never], cursor: 'c1', has_more: true}))
      .mockResolvedValueOnce(page({trips: [trip('bb')], cursor: 'c2'}));
    expect(hasSynced(db)).toBe(false);
    expect(await pullAll(db, fetch)).toBe(3);
    expect(fetch.mock.calls.map((c) => c[0])).toEqual([null, 'c1']);
    expect(metaGet(db, CURSOR_KEY)).toBe('c2');
    expect(hasSynced(db)).toBe(true);
    expect(listTrips(db, {}).total).toBe(2);
    expect(listVehicles(db)).toHaveLength(1);
  });

  it('removes what the server deleted', async () => {
    const db = setup();
    upsertTrips(db, [trip('a'), trip('bb')]);
    await pullAll(db, jest.fn().mockResolvedValue(page({deleted_trips: [{id: 'a'}], cursor: 'c3'})));
    expect(listTrips(db, {}).items.map((t) => t.id)).toEqual(['bb']);
  });

  it('keeps the old cursor when a page fails, so nothing is skipped', async () => {
    const db = setup();
    await pullAll(db, jest.fn().mockResolvedValue(page({cursor: 'c1'})));
    await expect(pullAll(db, jest.fn().mockRejectedValue(new Error('offline')))).rejects.toThrow('offline');
    expect(metaGet(db, CURSOR_KEY)).toBe('c1');
  });
});

describe('route backfill', () => {
  const detail = (id: string) => ({id, location_points: [{latitude: 1, longitude: 2}]}) as unknown as TripDetail;

  it('downloads missing routes newest first while allowed', async () => {
    const db = setup();
    upsertTrips(db, [trip('a'), trip('bb'), trip('ccc')]);
    putDetail(db, detail('a'));
    const fetch = jest.fn(async (id: string) => detail(id));
    expect(await backfillRoutes(db, () => true, fetch)).toBe(2);
    expect(fetch.mock.calls.map((c) => c[0])).toEqual(['ccc', 'bb']);
    expect(getDetail(db, 'bb')).not.toBeNull();
  });

  it('stops when no longer allowed (left Wi-Fi, drive started)', async () => {
    const db = setup();
    upsertTrips(db, [trip('a'), trip('bb')]);
    let allowed = 1;
    expect(await backfillRoutes(db, () => allowed-- > 0, jest.fn(async (id: string) => detail(id)))).toBe(1);
  });

  it('drops a drive the server no longer has, and pauses on other errors', async () => {
    const db = setup();
    upsertTrips(db, [trip('a'), trip('bb'), trip('ccc')]);
    const fetch = jest
      .fn()
      .mockRejectedValueOnce({response: {status: 404}})
      .mockRejectedValueOnce(new Error('timeout'));
    expect(await backfillRoutes(db, () => true, fetch)).toBe(0);
    expect(listTrips(db, {}).items.map((t) => t.id)).toEqual(['bb', 'a']);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
