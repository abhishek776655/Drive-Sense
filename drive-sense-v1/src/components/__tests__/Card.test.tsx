import React from 'react';
import {Text} from 'react-native';
import {render, screen, fireEvent} from '@testing-library/react-native';
import {Card, PressableCard, CARD_RADIUS} from '../Card';

const flatten = (style: unknown): Record<string, unknown> =>
  Array.isArray(style)
    ? style.filter(Boolean).reduce<Record<string, unknown>>((all, part) => ({...all, ...flatten(part)}), {})
    : ((style as Record<string, unknown>) ?? {});

describe('Card', () => {
  it('carries a shadow on the default raised tone', () => {
    render(
      <Card testID="card">
        <Text>content</Text>
      </Card>
    );

    const style = flatten(screen.getByTestId('card').props.style);
    // boxShadow, not the legacy shadow*/elevation pair: elevation ignores borderRadius and paints
    // a rectangular shadow outside the card's rounded corners.
    expect(style.boxShadow).toEqual(expect.any(String));
    expect(style.shadowOpacity).toBeUndefined();
    expect(style.elevation).toBeUndefined();
  });

  it('does not raise an inset panel, which sits below the surface', () => {
    render(
      <Card tone="inset" testID="card">
        <Text>content</Text>
      </Card>
    );

    const style = flatten(screen.getByTestId('card').props.style);
    expect(style.boxShadow).toBeUndefined();
  });

  it('lifts a subtle card less than a raised one', () => {
    const {unmount} = render(
      <Card tone="subtle" testID="card">
        <Text>subtle</Text>
      </Card>
    );
    const subtle = flatten(screen.getByTestId('card').props.style);
    unmount();

    render(
      <Card testID="card">
        <Text>raised</Text>
      </Card>
    );
    const raised = flatten(screen.getByTestId('card').props.style);

    expect(subtle.boxShadow).toEqual(expect.any(String));
    expect(subtle.boxShadow).not.toBe(raised.boxShadow);
  });

  it('resolves a named radius from the shared scale', () => {
    render(
      <Card radius="xl" testID="card">
        <Text>content</Text>
      </Card>
    );

    expect(flatten(screen.getByTestId('card').props.style).borderRadius).toBe(CARD_RADIUS.xl);
  });

  it('accepts an explicit radius', () => {
    render(
      <Card radius={9} testID="card">
        <Text>content</Text>
      </Card>
    );

    expect(flatten(screen.getByTestId('card').props.style).borderRadius).toBe(9);
  });

  it('omits padding when the card manages its own', () => {
    render(
      <Card padding={false} testID="card">
        <Text>content</Text>
      </Card>
    );

    expect(flatten(screen.getByTestId('card').props.style).padding).toBeUndefined();
  });

  it('lets a caller override the shared style', () => {
    render(
      <Card style={{marginBottom: 24}} testID="card">
        <Text>content</Text>
      </Card>
    );

    expect(flatten(screen.getByTestId('card').props.style).marginBottom).toBe(24);
  });
});

describe('PressableCard', () => {
  it('fires its press handler', () => {
    const onPress = jest.fn();
    render(
      <PressableCard onPress={onPress} accessibilityLabel="open trip">
        <Text>content</Text>
      </PressableCard>
    );

    fireEvent.press(screen.getByLabelText('open trip'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
