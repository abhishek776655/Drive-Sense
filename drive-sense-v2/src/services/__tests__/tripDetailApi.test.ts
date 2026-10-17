import {mockedApiClient, resetApiClientMocks} from '../../testUtils/mockApiClient';
import {tripDetailApi} from '../tripService';

jest.mock('../apiClient', () => ({
  apiClient: {get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn(), patch: jest.fn()},
}));

describe('tripDetailApi', () => {
  beforeEach(resetApiClientMocks);

  it('patches the trip with the new vehicle', async () => {
    mockedApiClient.patch.mockResolvedValueOnce({data: {}});
    await tripDetailApi.updateVehicle('t1', 'v2');
    expect(mockedApiClient.patch).toHaveBeenCalledWith('/api/v1/trips/t1', {vehicle_id: 'v2'});
  });
});
