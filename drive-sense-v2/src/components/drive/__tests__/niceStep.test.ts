import {niceStep} from '../CreativeGauges';

describe('niceStep', () => {
  it('picks round label steps for km/h and mph scales', () => {
    expect(niceStep(120)).toBe(20);
    expect(niceStep(200)).toBe(50);
    expect(niceStep(300)).toBe(50);
    expect(niceStep(75)).toBe(20);
    expect(niceStep(124)).toBe(25);
  });
});

describe('formatCoordinate', () => {
  const {formatCoordinate} = jest.requireActual('../CoordinatesChip');
  it('shows five decimals and the hemisphere', () => {
    expect(formatCoordinate(28.6129, 'lat')).toBe('28.61290° N');
    expect(formatCoordinate(-33.8688, 'lat')).toBe('33.86880° S');
    expect(formatCoordinate(77.2295, 'lon')).toBe('77.22950° E');
    expect(formatCoordinate(-0.1276, 'lon')).toBe('0.12760° W');
  });
});
