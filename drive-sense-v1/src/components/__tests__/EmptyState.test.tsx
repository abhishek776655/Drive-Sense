import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react-native';
import {EmptyState} from '../EmptyState';

describe('EmptyState', () => {
  it('names what is missing and what fills it', () => {
    render(<EmptyState icon="car-sport-outline" title="No vehicles yet" message="Add your first vehicle." />);

    expect(screen.getByText('No vehicles yet')).toBeTruthy();
    expect(screen.getByText('Add your first vehicle.')).toBeTruthy();
  });

  it('runs the offered action', () => {
    const onAction = jest.fn();
    render(
      <EmptyState
        icon="car-sport-outline"
        title="No vehicles yet"
        message="Add your first vehicle."
        actionLabel="Add Vehicle"
        onAction={onAction}
      />
    );

    fireEvent.press(screen.getByLabelText('Add Vehicle'));

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('omits the button when there is nothing to do', () => {
    render(<EmptyState icon="search-outline" title="No matching trips" message="Try another search." />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('omits the button when a label is given with no handler', () => {
    render(
      <EmptyState icon="search-outline" title="No matching trips" message="Try another search." actionLabel="Do it" />
    );

    expect(screen.queryByLabelText('Do it')).toBeNull();
  });
});
