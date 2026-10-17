import {useDashboardStore} from '../dashboardStore';
import {dashboardService, type TrendView} from '../../services/dashboardService';

jest.mock('../../services/dashboardService', () => ({
  dashboardService: {
    getDashboard: jest.fn(),
    getTrend: jest.fn(),
    getRecurringInsights: jest.fn(),
  },
}));

const mockedGetTrend = dashboardService.getTrend as jest.MockedFunction<typeof dashboardService.getTrend>;

const makeTrendView = (granularity: TrendView['granularity']): TrendView => ({
  granularity,
  buckets: [
    {key: 'a', label: 'A', detailLabel: 'Bucket A', distanceKm: 1, tripCount: 1, score: 80},
    {key: 'b', label: 'B', detailLabel: 'Bucket B', distanceKm: 2, tripCount: 1, score: 90},
  ],
  previousKm: [3, 4],
  subtitle: `Last 2 ${granularity}s vs prior 2 ${granularity}s`,
  currentLabel: 'Current',
  previousLabel: 'Previous',
  metricValue: '3 km',
  metricLabel: '2 trips',
  metricDelta: '-57%',
});

describe('useDashboardStore.setTrendGranularity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useDashboardStore.setState({
      trendGranularity: 'day',
      trendCache: {},
      trendLoading: false,
      trendError: null,
    });
  });

  it('fetches and caches the requested range', async () => {
    mockedGetTrend.mockResolvedValue(makeTrendView('week'));

    await useDashboardStore.getState().setTrendGranularity('week');

    expect(mockedGetTrend).toHaveBeenCalledWith('week');
    expect(useDashboardStore.getState().trendGranularity).toBe('week');
    expect(useDashboardStore.getState().trendCache.week?.buckets.map((item) => item.distanceKm)).toEqual([1, 2]);
    expect(useDashboardStore.getState().trendLoading).toBe(false);
  });

  it('does not blank the chart while a cached range refreshes', async () => {
    useDashboardStore.setState({trendCache: {month: makeTrendView('month')}});
    let resolveFetch: (view: TrendView) => void = () => {};
    mockedGetTrend.mockReturnValue(
      new Promise<TrendView>((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const pending = useDashboardStore.getState().setTrendGranularity('month');
    expect(useDashboardStore.getState().trendLoading).toBe(false);

    resolveFetch(makeTrendView('month'));
    await pending;
  });

  it('records an error for the range the user is looking at', async () => {
    mockedGetTrend.mockRejectedValue(new Error('offline'));

    await useDashboardStore.getState().setTrendGranularity('week');

    expect(useDashboardStore.getState().trendError).toBeTruthy();
    expect(useDashboardStore.getState().trendLoading).toBe(false);
  });

  it('does not surface an error from a range the user already navigated away from', async () => {
    mockedGetTrend.mockRejectedValue(new Error('offline'));

    const abandoned = useDashboardStore.getState().setTrendGranularity('week');
    useDashboardStore.setState({trendGranularity: 'month'});
    await abandoned;

    expect(useDashboardStore.getState().trendError).toBeNull();
  });

  it('still caches a late response for a range the user left', async () => {
    mockedGetTrend.mockResolvedValue(makeTrendView('week'));

    const abandoned = useDashboardStore.getState().setTrendGranularity('week');
    useDashboardStore.setState({trendGranularity: 'month', trendLoading: true});
    await abandoned;

    expect(useDashboardStore.getState().trendCache.week).toBeDefined();
    // The month request owns the spinner now; the stale week response must not clear it.
    expect(useDashboardStore.getState().trendLoading).toBe(true);
  });
});
