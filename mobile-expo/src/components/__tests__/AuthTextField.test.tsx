import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react-native';
import {AuthTextField} from '../AuthTextField';

const flatten = (style: unknown): Record<string, unknown> =>
  Array.isArray(style)
    ? style.filter(Boolean).reduce<Record<string, unknown>>((all, part) => ({...all, ...flatten(part)}), {})
    : ((style as Record<string, unknown>) ?? {});

describe('AuthTextField', () => {
  it('passes typing through to the caller', () => {
    const onChangeText = jest.fn();
    render(<AuthTextField icon="mail-outline" placeholder="Email" onChangeText={onChangeText} />);

    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'driver@example.com');

    expect(onChangeText).toHaveBeenCalledWith('driver@example.com');
  });

  it('never sets a lineHeight, which clips descenders inside an Android TextInput', () => {
    render(<AuthTextField icon="mail-outline" placeholder="Email" />);

    expect(flatten(screen.getByPlaceholderText('Email').props.style).lineHeight).toBeUndefined();
  });

  it('centres text in the fixed-height row without vertical padding', () => {
    render(<AuthTextField icon="mail-outline" placeholder="Email" />);
    const style = flatten(screen.getByPlaceholderText('Email').props.style);

    expect(style.padding).toBe(0);
    expect(style.textAlignVertical).toBe('center');
    expect(style.includeFontPadding).toBe(false);
  });

  it('suppresses the Android underline', () => {
    render(<AuthTextField icon="mail-outline" placeholder="Email" />);

    expect(screen.getByPlaceholderText('Email').props.underlineColorAndroid).toBe('transparent');
  });

  it('masks a secure field until the toggle is pressed', () => {
    render(<AuthTextField icon="lock-closed-outline" placeholder="Password" secure />);
    expect(screen.getByPlaceholderText('Password').props.secureTextEntry).toBe(true);

    fireEvent.press(screen.getByLabelText('Show password'));

    expect(screen.getByPlaceholderText('Password').props.secureTextEntry).toBe(false);
    expect(screen.getByLabelText('Hide password')).toBeTruthy();
  });

  it('disables autocorrect on a masked field by default', () => {
    render(<AuthTextField icon="lock-closed-outline" placeholder="Password" secure />);

    expect(screen.getByPlaceholderText('Password').props.autoCorrect).toBe(false);
  });

  it('lets a caller override autocorrect', () => {
    render(<AuthTextField icon="mail-outline" placeholder="Email" autoCorrect />);

    expect(screen.getByPlaceholderText('Email').props.autoCorrect).toBe(true);
  });

  it('shows a field error beneath the input', () => {
    render(<AuthTextField icon="mail-outline" placeholder="Email" error="Enter your email address." />);

    expect(screen.getByText('Enter your email address.')).toBeTruthy();
  });

  it('still forwards focus and blur handlers the caller supplied', () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    render(<AuthTextField icon="mail-outline" placeholder="Email" onFocus={onFocus} onBlur={onBlur} />);
    const input = screen.getByPlaceholderText('Email');

    fireEvent(input, 'focus');
    fireEvent(input, 'blur');

    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});
