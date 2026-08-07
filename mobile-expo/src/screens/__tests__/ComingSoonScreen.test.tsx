import React from 'react';
import {render, screen} from '@testing-library/react-native';
import {ComingSoonScreen} from '../ComingSoonScreen';
import type {ComingSoonScreenProps} from '../../navigation/types';

const makeProps = (params: ComingSoonScreenProps['route']['params']): ComingSoonScreenProps =>
  ({
    navigation: {goBack: jest.fn()} as unknown as ComingSoonScreenProps['navigation'],
    route: {params} as ComingSoonScreenProps['route'],
  }) as ComingSoonScreenProps;

describe('ComingSoonScreen', () => {
  it('renders the given title and message', () => {
    render(<ComingSoonScreen {...makeProps({title: 'Geofencing', message: 'Custom message'})} />);

    expect(screen.getAllByText('Geofencing').length).toBeGreaterThan(0);
    expect(screen.getByText('Custom message')).toBeTruthy();
  });

  it('renders a default message when none is given', () => {
    render(<ComingSoonScreen {...makeProps({title: 'Notifications'})} />);

    expect(screen.getByText("We're still building this — check back soon.")).toBeTruthy();
  });
});
