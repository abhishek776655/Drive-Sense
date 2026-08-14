import {AxiosError, AxiosHeaders} from 'axios';
import {getApiErrorMessage, sanitizeErrorText} from '../apiClient';

const SERVER_MESSAGE = 'The server is having trouble right now. Please try again in a moment.';

const axiosError = (status: number, data: unknown, url = '/api/v1/trips'): AxiosError => {
  const config = {url, headers: new AxiosHeaders()} as never;
  const error = new AxiosError(`Request failed with status code ${status}`, String(status), config);
  error.response = {status, data, statusText: '', headers: {}, config} as never;
  return error;
};

describe('getApiErrorMessage', () => {
  it('never leaks a 500 body to the user', () => {
    expect(getApiErrorMessage(axiosError(500, {detail: 'Internal Server Error'}))).toBe(SERVER_MESSAGE);
  });

  it('hides a database error detail behind the generic server message', () => {
    const detail = 'column trips.start_address does not exist';

    expect(getApiErrorMessage(axiosError(500, {detail}))).toBe(SERVER_MESSAGE);
  });

  it('hides 502, 503 and 504 the same way', () => {
    for (const status of [502, 503, 504]) {
      expect(getApiErrorMessage(axiosError(status, {}))).toBe(SERVER_MESSAGE);
    }
  });

  it('never surfaces the raw status code', () => {
    for (const status of [500, 502, 503]) {
      expect(getApiErrorMessage(axiosError(status, {}))).not.toContain(String(status));
    }
  });

  it('still shows an actionable 4xx detail', () => {
    expect(getApiErrorMessage(axiosError(404, {detail: 'Trip not found'}))).toBe('Trip not found');
  });

  it('uses the caller fallback for a 4xx with no detail', () => {
    expect(getApiErrorMessage(axiosError(400, {}), 'Unable to end trip in backend')).toBe(
      'Unable to end trip in backend',
    );
  });

  it('reports an unreachable server as a connection problem', () => {
    const error = new AxiosError('Network Error', 'ERR_NETWORK', {headers: new AxiosHeaders()} as never);

    expect(getApiErrorMessage(error)).toBe(
      'Unable to reach the server right now. Check your connection and try again.',
    );
  });

  it('explains an expired session rather than showing a 401', () => {
    expect(getApiErrorMessage(axiosError(401, {detail: 'Not authenticated'}))).toBe(
      'Your session expired. Sign in again to continue.',
    );
  });

  it('keeps the login form 401 specific', () => {
    const message = getApiErrorMessage(
      axiosError(401, {detail: 'Invalid credentials'}, '/api/v1/auth/login'),
    );

    expect(message).toBe('Invalid credentials');
  });

  it('falls back for a plain error with no message', () => {
    expect(getApiErrorMessage({}, 'Location sync failed')).toBe('Location sync failed');
  });
});

describe('sanitizeErrorText', () => {
  it('replaces axios status-code text for a server failure', () => {
    expect(sanitizeErrorText('Request failed with status code 500')).toBe(SERVER_MESSAGE);
  });

  it('replaces axios status-code text for a client failure with the fallback', () => {
    expect(sanitizeErrorText('Request failed with status code 404', 'Could not load that trip')).toBe(
      'Could not load that trip',
    );
  });

  it('leaves an ordinary message untouched', () => {
    expect(sanitizeErrorText('Location permission denied')).toBe('Location permission denied');
  });
});
