import React from 'react';
import {render, screen} from '@testing-library/react-native';
import {TripListItem} from '../TripListItem';

describe('TripListItem', () => {
  it('renders the top speed chip when a top speed is known', () => {
    render(
      <TripListItem id="trip-1" distance={12000} duration={1800} score={88} topSpeedLabel="65 km/h" />
    );

    expect(screen.getByText('Top')).toBeTruthy();
    expect(screen.getByText('65 km/h')).toBeTruthy();
  });

  it('hides the chip entirely when no top speed was recorded', () => {
    render(<TripListItem id="trip-1" distance={12000} duration={1800} score={88} />);

    expect(screen.queryByText('Top')).toBeNull();
  });

  it('renders the geocoded addresses in the route rail', () => {
    render(
      <TripListItem
        id="trip-1"
        distance={12000}
        duration={1800}
        score={88}
        startLabel="Indiranagar, Bengaluru"
        endLabel="Koramangala, Bengaluru"
      />
    );

    expect(screen.getByText('Indiranagar, Bengaluru')).toBeTruthy();
    expect(screen.getByText('Koramangala, Bengaluru')).toBeTruthy();
  });

  it('says the address is unavailable rather than filling the slot with something else', () => {
    render(<TripListItem id="trip-1" distance={12000} duration={1800} score={88} vehicleName="Honda City" />);

    expect(screen.getByText('Start not available')).toBeTruthy();
    expect(screen.getByText('End not available')).toBeTruthy();
  });

  it('keeps the vehicle out of the route rail', () => {
    render(
      <TripListItem
        id="trip-1"
        distance={12000}
        duration={1800}
        score={88}
        vehicleName="Honda City"
        startLabel="Indiranagar, Bengaluru"
        endLabel="Koramangala, Bengaluru"
      />
    );

    // Present on the card, but never as one of the two endpoints.
    expect(screen.getByText('Honda City')).toBeTruthy();
    expect(screen.getByText('Indiranagar, Bengaluru')).toBeTruthy();
    expect(screen.getByText('Koramangala, Bengaluru')).toBeTruthy();
  });

  it('omits the vehicle line when no vehicle is given', () => {
    render(<TripListItem id="trip-1" distance={12000} duration={1800} score={88} />);

    expect(screen.queryByText('Honda City')).toBeNull();
  });

  it('keeps the average and top speed chips distinguishable', () => {
    render(
      <TripListItem
        id="trip-1"
        distance={12000}
        duration={1800}
        score={88}
        avgSpeedLabel="24 km/h"
        topSpeedLabel="65 km/h"
      />
    );

    expect(screen.getByText('24 km/h')).toBeTruthy();
    expect(screen.getByText('65 km/h')).toBeTruthy();
  });
});
