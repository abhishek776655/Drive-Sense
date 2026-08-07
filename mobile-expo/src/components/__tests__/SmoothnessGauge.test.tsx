import React from 'react';
import {render, screen} from '@testing-library/react-native';
import {getSmoothnessBand, SmoothnessGauge} from '../SmoothnessGauge';

describe('getSmoothnessBand', () => {
  it('returns smooth near resting gravity', () => {
    expect(getSmoothnessBand(9.81)).toBe('smooth');
  });

  it('returns moderate for a mid deviation', () => {
    expect(getSmoothnessBand(9.81 + 3.2)).toBe('moderate');
  });

  it('returns harsh for a large deviation', () => {
    expect(getSmoothnessBand(9.81 + 4.0)).toBe('harsh');
  });
});

describe('SmoothnessGauge', () => {
  it('renders the band label and magnitude', () => {
    render(<SmoothnessGauge magnitude={9.81} />);

    expect(screen.getByText(/Smooth/)).toBeTruthy();
    expect(screen.getByText(/9\.8 m\/s²/)).toBeTruthy();
  });
});
