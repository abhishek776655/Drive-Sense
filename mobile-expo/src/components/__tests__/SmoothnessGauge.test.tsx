import React from 'react';
import {render, screen} from '@testing-library/react-native';
import {getSmoothnessBand, SmoothnessGauge} from '../SmoothnessGauge';

describe('getSmoothnessBand', () => {
  it('returns smooth near resting gravity', () => {
    expect(getSmoothnessBand(9.81)).toBe('smooth');
  });

  it('treats a zero (unavailable) reading as smooth, not harsh', () => {
    expect(getSmoothnessBand(0)).toBe('smooth');
  });

  it('returns moderate when the horizontal-equivalent acceleration is between 3.0 and 3.5 m/s²', () => {
    // Total magnitude including gravity for a 3.2 m/s² horizontal acceleration:
    // sqrt(9.81^2 + 3.2^2) ≈ 10.319
    expect(getSmoothnessBand(Math.sqrt(9.81 ** 2 + 3.2 ** 2))).toBe('moderate');
  });

  it('returns harsh when the horizontal-equivalent acceleration is at or above 3.5 m/s²', () => {
    // Total magnitude including gravity for a 4.0 m/s² horizontal acceleration:
    // sqrt(9.81^2 + 4.0^2) ≈ 10.594
    expect(getSmoothnessBand(Math.sqrt(9.81 ** 2 + 4.0 ** 2))).toBe('harsh');
  });
});

describe('SmoothnessGauge', () => {
  it('renders the band label and magnitude', () => {
    render(<SmoothnessGauge magnitude={9.81} />);

    expect(screen.getByText(/Smooth/)).toBeTruthy();
    expect(screen.getByText(/9\.8 m\/s²/)).toBeTruthy();
  });
});
