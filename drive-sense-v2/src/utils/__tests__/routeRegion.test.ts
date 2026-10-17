import {routeRegion} from '../routeRegion';

describe('routeRegion', () => {
  it('covers the whole route with a margin', () => {
    const region = routeRegion([
      {latitude: 28.6129, longitude: 77.2295},
      {latitude: 28.6129, longitude: 77.233},
      {latitude: 28.6175, longitude: 77.233},
    ]);
    expect(region?.latitude).toBeCloseTo(28.6152, 4);
    expect(region?.longitude).toBeCloseTo(77.23125, 4);
    expect(region!.latitudeDelta).toBeGreaterThan(0.0046);
    expect(region!.longitudeDelta).toBeGreaterThan(0.0035);
  });

  it('keeps a minimum span and handles empty routes', () => {
    expect(routeRegion([{latitude: 28.6, longitude: 77.2}])?.latitudeDelta).toBe(0.004);
    expect(routeRegion([])).toBeNull();
  });
});
