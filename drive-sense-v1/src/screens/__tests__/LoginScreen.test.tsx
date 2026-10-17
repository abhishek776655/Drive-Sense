import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {LoginScreen, validateLogin} from '../LoginScreen';
import {authService} from '../../services/apiClient';

jest.mock('../../services/apiClient', () => ({
  authService: {login: jest.fn()},
  getApiErrorMessage: (error: unknown, fallback = 'Something went wrong. Please try again.') =>
    error instanceof Error ? error.message : fallback,
}));

const mockedLogin = authService.login as jest.MockedFunction<typeof authService.login>;

const valid = {email: 'driver@example.com', password: 'goodpassword'};

describe('validateLogin', () => {
  it('accepts a well-formed sign-in', () => {
    expect(validateLogin(valid)).toEqual({});
  });

  it('requires an email', () => {
    expect(validateLogin({...valid, email: '  '}).email).toBeTruthy();
  });

  it('rejects a malformed email', () => {
    expect(validateLogin({...valid, email: 'driver@'}).email).toBeTruthy();
  });

  it('requires a password', () => {
    expect(validateLogin({...valid, password: ''}).password).toBeTruthy();
  });

  it('does not impose a length rule, so pre-existing passwords still sign in', () => {
    expect(validateLogin({...valid, password: 'abc'})).toEqual({});
  });

  it('ignores surrounding whitespace on the email', () => {
    expect(validateLogin({...valid, email: '  driver@example.com  '})).toEqual({});
  });
});

describe('LoginScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not call the API when the form is invalid', () => {
    render(<LoginScreen onLoginSuccess={jest.fn()} onGoToRegister={jest.fn()} />);

    fireEvent.press(screen.getByLabelText('Sign In'));

    expect(mockedLogin).not.toHaveBeenCalled();
    expect(screen.getByText('Enter your email address.')).toBeTruthy();
    expect(screen.getByText('Enter your password.')).toBeTruthy();
  });

  it('clears a field error as soon as the field is edited', () => {
    render(<LoginScreen onLoginSuccess={jest.fn()} onGoToRegister={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('Sign In'));

    fireEvent.changeText(screen.getByPlaceholderText('Email'), valid.email);

    expect(screen.queryByText('Enter your email address.')).toBeNull();
  });

  it('signs in with the trimmed email', async () => {
    const onLoginSuccess = jest.fn();
    mockedLogin.mockResolvedValue('token');
    render(<LoginScreen onLoginSuccess={onLoginSuccess} onGoToRegister={jest.fn()} />);

    fireEvent.changeText(screen.getByPlaceholderText('Email'), `  ${valid.email}  `);
    fireEvent.changeText(screen.getByPlaceholderText('Password'), valid.password);
    fireEvent.press(screen.getByLabelText('Sign In'));

    await waitFor(() => expect(onLoginSuccess).toHaveBeenCalledTimes(1));
    expect(mockedLogin).toHaveBeenCalledWith(valid.email, valid.password);
  });

  it('surfaces a rejected sign-in without navigating on', async () => {
    const onLoginSuccess = jest.fn();
    mockedLogin.mockRejectedValue(new Error('Invalid credentials'));
    render(<LoginScreen onLoginSuccess={onLoginSuccess} onGoToRegister={jest.fn()} />);

    fireEvent.changeText(screen.getByPlaceholderText('Email'), valid.email);
    fireEvent.changeText(screen.getByPlaceholderText('Password'), valid.password);
    fireEvent.press(screen.getByLabelText('Sign In'));

    await waitFor(() => expect(screen.getByText('Invalid credentials')).toBeTruthy());
    expect(onLoginSuccess).not.toHaveBeenCalled();
  });
});
