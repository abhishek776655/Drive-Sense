import {speedColor, speedScaleStops} from '../speedColor';

const colors = {cyan: '#000000', green: '#640000', amber: '#C80000', accent: '#FF0000', red: '#FFFFFF'};

describe('speedColor', () => {
  it('returns the stop colour exactly at a stop', () => {
    expect(speedColor(0, colors)).toBe('#000000');
    expect(speedColor(50, colors)).toBe('#c80000');
  });

  it('interpolates between stops', () => {
    // halfway between #000000 (0) and #640000 (25): red channel 50 = 0x32
    expect(speedColor(12.5, colors)).toBe('#320000');
  });

  it('clamps below 0 and above 100', () => {
    expect(speedColor(-10, colors)).toBe('#000000');
    expect(speedColor(180, colors)).toBe('#ffffff');
  });

  it('falls back to the lower stop when a colour is not hex', () => {
    expect(speedColor(10, {...colors, green: 'rgba(0,0,0,0.5)'})).toBe('#000000');
  });

  it('lists the scale stops for a legend', () => {
    expect(speedScaleStops(colors).map((s) => s.kmh)).toEqual([0, 25, 50, 75, 100]);
  });
});
