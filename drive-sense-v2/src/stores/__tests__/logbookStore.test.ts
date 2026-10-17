import {tripService, tripUploadApi, type TripListResult, type TripSummary} from '../../services/tripService';
import {DEFAULT_FILTERS, useLogbookStore} from '../logbookStore';

jest.mock('../../services/tripService', () => ({
  tripService: {list: jest.fn(), routes: jest.fn()},
  tripUploadApi: {remove: jest.fn()},
}));

const list = tripService.list as jest.MockedFunction<typeof tripService.list>;
const routes = tripService.routes as jest.MockedFunction<typeof tripService.routes>;
const remove = tripUploadApi.remove as jest.MockedFunction<typeof tripUploadApi.remove>;

const trip = (id: string): TripSummary => ({
  id,
  vehicle_name: 'City',
  state: 'ended',
  start_time: '2026-10-11T14:00:00Z',
  end_time: '2026-10-11T14:20:00Z',
  distance_meters: 1000,
  duration_seconds: 600,
  driving_score: 90,
  max_speed_mps: 10,
  start_address: null,
  end_address: null,
  event_count: 0,
});

const page = (ids: string[], total = ids.length): TripListResult => ({
  items: ids.map(trip),
  total,
  totals: {count: total, distance_meters: total * 1000, duration_seconds: total * 600, max_speed_mps: 10},
});

const store = () => useLogbookStore.getState();

describe('logbookStore', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    routes.mockResolvedValue([]);
    useLogbookStore.setState({filters: DEFAULT_FILTERS, items: [], total: 0, totals: null, routes: [], status: 'idle', error: null, selecting: false, selected: []});
  });

  it('loads the first page and routes with the default month filter', async () => {
    list.mockResolvedValueOnce(page(['a', 'b']));
    await store().load();
    const params = list.mock.calls[0][0]!;
    expect(params.sort).toBe('newest');
    expect(params.offset).toBe(0);
    expect(new Date(params.from!).getDate()).toBe(1);
    expect(routes).toHaveBeenCalledTimes(1);
    expect(store().items.map((t) => t.id)).toEqual(['a', 'b']);
    expect(store().status).toBe('ready');
  });

  it('appends the next page on loadMore and stops at total', async () => {
    list.mockResolvedValueOnce(page(['a', 'b'], 3)).mockResolvedValueOnce(page(['c'], 3));
    await store().load();
    await store().loadMore();
    expect(list.mock.calls[1][0]!.offset).toBe(2);
    expect(store().items.map((t) => t.id)).toEqual(['a', 'b', 'c']);
    await store().loadMore();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('drops a stale response when filters change mid-flight', async () => {
    let resolveFirst: (r: TripListResult) => void = () => undefined;
    list.mockImplementationOnce(() => new Promise((r) => (resolveFirst = r))).mockResolvedValueOnce(page(['new']));
    const first = store().load();
    await store().setFilters({search: 'delhi'});
    resolveFirst(page(['old']));
    await first;
    expect(store().items.map((t) => t.id)).toEqual(['new']);
  });

  it('setFilters resets paging', async () => {
    list.mockResolvedValueOnce(page(['a', 'b'], 4)).mockResolvedValueOnce(page(['c', 'd'], 4)).mockResolvedValueOnce(page(['x'], 1));
    await store().load();
    await store().loadMore();
    await store().setFilters({sort: 'fastest'});
    expect(list.mock.calls[2][0]).toMatchObject({sort: 'fastest', offset: 0});
    expect(store().items.map((t) => t.id)).toEqual(['x']);
  });

  it('deletes selected trips one by one and keeps failures selected', async () => {
    list.mockResolvedValueOnce(page(['a', 'b', 'c'])).mockResolvedValue(page(['b', 'c']));
    await store().load();
    store().startSelect();
    store().toggle('a');
    store().toggle('b');
    remove.mockImplementation(async (id) => {
      if (id === 'b') {
        throw new Error('offline');
      }
    });
    const result = await store().deleteSelected();
    expect(result).toEqual({deleted: 1, failed: 1});
    expect(store().selected).toEqual(['b']);
    expect(store().selecting).toBe(true);
    expect(store().items.map((t) => t.id)).not.toContain('a');
  });
});
