import {dashboardService, type RecurringInsight} from '../dashboardService';
import {mockApiGet, mockedApiClient, resetApiClientMocks} from '../../testUtils/mockApiClient';

jest.mock('../apiClient', () => ({
  apiClient: {
    delete: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

describe('dashboardService.getRecurringInsights', () => {
  beforeEach(() => {
    resetApiClientMocks();
  });

  it('fetches and returns the recurring insights list', async () => {
    const response: RecurringInsight[] = [
      {
        rule_id: 'recurring_harsh_brake_evening',
        category: 'pattern',
        tone: 'warning',
        title: 'Frequent harsh braking',
        message: 'You harsh brake most often in the evening.',
        metric_label: 'Occurrences',
        metric_value: '9 events',
        priority: 9,
      },
    ];
    mockApiGet(response);

    const result = await dashboardService.getRecurringInsights();

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/dashboard/insights');
    expect(result).toEqual(response);
  });
});
