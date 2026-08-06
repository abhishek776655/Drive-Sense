import {apiClient} from '../services/apiClient';

type MockableApiClient = Pick<typeof apiClient, 'delete' | 'get' | 'post' | 'put'>;

export const mockedApiClient = apiClient as unknown as jest.Mocked<MockableApiClient>;

export const resetApiClientMocks = () => {
  mockedApiClient.delete.mockReset();
  mockedApiClient.get.mockReset();
  mockedApiClient.post.mockReset();
  mockedApiClient.put.mockReset();
};

export const mockApiDelete = () => {
  mockedApiClient.delete.mockResolvedValueOnce({data: undefined});
};

export const mockApiGet = <TData>(data: TData) => {
  mockedApiClient.get.mockResolvedValueOnce({data});
};

export const mockApiPost = <TData>(data: TData) => {
  mockedApiClient.post.mockResolvedValueOnce({data});
};

export const mockApiPut = <TData>(data: TData) => {
  mockedApiClient.put.mockResolvedValueOnce({data});
};
