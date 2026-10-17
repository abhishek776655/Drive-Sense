import {statsService, type StatsOverview} from '../../services/statsService';
import {useStatsStore} from '../statsStore';

jest.mock('../../services/statsService', () => ({statsService: {overview: jest.fn()}}));

const overview = statsService.overview as jest.MockedFunction<typeof statsService.overview>;
const data = (period: StatsOverview['period']) => ({period}) as StatsOverview;

describe('statsStore', () => {
  beforeEach(() => {
    overview.mockReset();
    useStatsStore.setState({period: 'month', vehicleId: null, range: null, data: null, status: 'idle', error: null});
  });

  it('loads with the current filters', async () => {
    overview.mockResolvedValueOnce(data('week'));
    await useStatsStore.getState().setFilters({period: 'week', vehicleId: 'v1'});
    expect(overview).toHaveBeenCalledWith({period: 'week', vehicleId: 'v1', range: null, overKmh: 100});
    expect(useStatsStore.getState().data?.period).toBe('week');
    expect(useStatsStore.getState().status).toBe('ready');
  });

  it('sends a custom range', async () => {
    overview.mockResolvedValueOnce(data('custom'));
    const range = {start: '2026-08-01', end: '2026-08-31'};
    await useStatsStore.getState().setFilters({period: 'custom', range});
    expect(overview).toHaveBeenCalledWith({period: 'custom', vehicleId: null, range, overKmh: 100});
  });

  it('drops a response that arrives after a newer request', async () => {
    let resolveSlow: (value: StatsOverview) => void = () => undefined;
    overview.mockReturnValueOnce(new Promise((resolve) => (resolveSlow = resolve)));
    overview.mockResolvedValueOnce(data('year'));
    const slow = useStatsStore.getState().setFilters({period: 'week'});
    await useStatsStore.getState().setFilters({period: 'year'});
    resolveSlow(data('week'));
    await slow;
    expect(useStatsStore.getState().data?.period).toBe('year');
  });

  it('keeps the last data and reports the error when a load fails', async () => {
    useStatsStore.setState({data: data('month')});
    overview.mockRejectedValueOnce(new Error('down'));
    await useStatsStore.getState().load();
    expect(useStatsStore.getState().status).toBe('error');
    expect(useStatsStore.getState().data?.period).toBe('month');
    expect(useStatsStore.getState().error).toBeTruthy();
  });
});
