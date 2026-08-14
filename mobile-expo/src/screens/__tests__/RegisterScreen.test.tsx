import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {RegisterScreen, validateRegistration, MIN_PASSWORD_LENGTH} from '../RegisterScreen';
import {authService} from '../../services/apiClient';

jest.mock('../../services/apiClient', () => ({
  authService: {register: jest.fn(), login: jest.fn()},
  getApiErrorMessage: (error: unknown, fallback = 'Something went wrong. Please try again.') =>
    error instanceof Error ? error.message : fallback,
}));

const mockedRegister = authService.register as jest.MockedFunction<typeof authService.register>;
const mockedLogin = authService.login as jest.MockedFunction<typeof authService.login>;

const valid = {email: 'driver@example.com', password: 'goodpassword', confirmPassword: 'goodpassword'};

describe('validateRegistration', () => {
  it('accepts a well-formed signup', () => {
    expect(validateRegistration(valid)).toEqual({});
  });

  it('requires an email', () => {
    expect(validateRegistration({...valid, email: '  '}).email).toBeTruthy();
  });

  it('rejects a malformed email', () => {
    expect(validateRegistration({...valid, email: 'driver@'}).email).toBeTruthy();
  });

  it('enforces the backend minimum password length', () => {
    const short = 'a'.repeat(MIN_PASSWORD_LENGTH - 1);

    expect(validateRegistration({email: valid.email, password: short, confirmPassword: short}).password).toBeTruthy();
  });

  it('rejects a mismatched confirmation', () => {
    expect(validateRegistration({...valid, confirmPassword: 'different'}).confirmPassword).toBeTruthy();
  });

  it('does not nag about the confirmation before a password is typed', () => {
    const errors = validateRegistration({email: valid.email, password: '', confirmPassword: ''});

    expect(errors.password).toBeTruthy();
    expect(errors.confirmPassword).toBeUndefined();
  });

  it('ignores surrounding whitespace on the email', () => {
    expect(validateRegistration({...valid, email: '  driver@example.com  '})).toEqual({});
  });
});

describe('RegisterScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  const fill = () => {
    fireEvent.changeText(screen.getByPlaceholderText('Email'), valid.email);
    fireEvent.changeText(screen.getByPlaceholderText('Password'), valid.password);
    fireEvent.changeText(screen.getByPlaceholderText('Confirm password'), valid.confirmPassword);
  };

  it('does not call the API when the form is invalid', () => {
    render(<RegisterScreen onRegisterSuccess={jest.fn()} onGoToLogin={jest.fn()} />);

    fireEvent.press(screen.getByLabelText('Create Account'));

    expect(mockedRegister).not.toHaveBeenCalled();
    expect(screen.getByText('Enter your email address.')).toBeTruthy();
  });

  it('registers then signs in, so the user does not retype credentials', async () => {
    const onRegisterSuccess = jest.fn();
    mockedRegister.mockResolvedValue({});
    mockedLogin.mockResolvedValue('token');
    render(<RegisterScreen onRegisterSuccess={onRegisterSuccess} onGoToLogin={jest.fn()} />);

    fill();
    fireEvent.press(screen.getByLabelText('Create Account'));

    await waitFor(() => expect(onRegisterSuccess).toHaveBeenCalledTimes(1));
    expect(mockedRegister).toHaveBeenCalledWith(valid.email, valid.password);
    expect(mockedLogin).toHaveBeenCalledWith(valid.email, valid.password);
  });

  it('surfaces a rejected signup without navigating on', async () => {
    const onRegisterSuccess = jest.fn();
    mockedRegister.mockRejectedValue(new Error('Email already registered'));
    render(<RegisterScreen onRegisterSuccess={onRegisterSuccess} onGoToLogin={jest.fn()} />);

    fill();
    fireEvent.press(screen.getByLabelText('Create Account'));

    await waitFor(() => expect(screen.getByText('Email already registered')).toBeTruthy());
    expect(onRegisterSuccess).not.toHaveBeenCalled();
  });

  it('offers a way back to sign in', () => {
    const onGoToLogin = jest.fn();
    render(<RegisterScreen onRegisterSuccess={jest.fn()} onGoToLogin={onGoToLogin} />);

    fireEvent.press(screen.getByLabelText('Go to sign in'));

    expect(onGoToLogin).toHaveBeenCalledTimes(1);
  });
});
