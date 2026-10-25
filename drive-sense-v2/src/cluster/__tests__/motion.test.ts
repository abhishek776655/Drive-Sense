import {angleAt, arcPath, compassPoint, dialMax, fraction, gFrom, gPoint, gradePct, isCoasting, loadHeat, particleSpeed, redlineHeat, shiftUpHint, ticks} from '../motion';

describe('cluster motion maths', () => {
  it('maps values onto the 270° dial', () => {
    expect(fraction(60, 240)).toBe(0.25);
    expect(fraction(300, 240)).toBe(1);
    expect(fraction(null, 240)).toBe(0);
    expect(angleAt(0)).toBe(135);
    expect(angleAt(1)).toBe(405);
    expect(angleAt(0.5)).toBe(270); // straight up
  });

  it('draws arcs, taking the long way round past 180°', () => {
    // Half the dial is 135°: the short way, ending straight up.
    expect(arcPath(100, 100, 50, 0, 0.5)).toBe('M 64.64 135.36 A 50 50 0 0 1 100 50');
    // Three quarters is 202.5°: the long way.
    expect(arcPath(100, 100, 50, 0, 0.75)).toContain(' 0 1 1 ');
  });

  it('lays out major and minor ticks', () => {
    const t = ticks(40, 20, 10);
    expect(t).toEqual([
      {value: 0, major: true},
      {value: 10, major: false},
      {value: 20, major: true},
      {value: 30, major: false},
      {value: 40, major: true},
    ]);
  });

  it('rounds the dial top up to a step', () => {
    expect(dialMax(8000, 1000, 6500)).toBe(8000);
    expect(dialMax(8000, 1000, 8300)).toBe(9000);
    expect(dialMax(200, 40, null, 215)).toBe(240);
  });

  it('heats the redline over the last 1,000 rpm', () => {
    expect(redlineHeat(4000, 6000)).toBe(0);
    expect(redlineHeat(5500, 6000)).toBe(0.5);
    expect(redlineHeat(6400, 6000)).toBe(1);
  });

  it('speeds particles up with load and warms them past 80 %', () => {
    expect(particleSpeed(0)).toBeCloseTo(0.08, 5);
    expect(particleSpeed(100)).toBeCloseTo(0.98, 5);
    expect(particleSpeed(50)).toBeLessThan(particleSpeed(80));
    expect(loadHeat(70)).toBe(0);
    expect(loadHeat(90)).toBe(0.5);
  });

  it('knows coasting from a closed throttle while rolling', () => {
    expect(isCoasting(15, 14, 50)).toBe(true);
    expect(isCoasting(25, 14, 50)).toBe(false);
    expect(isCoasting(14, 14, 2)).toBe(false); // standing still is idling, not coasting
    expect(isCoasting(14, null, 50)).toBe(false);
  });

  it('works out G from speed and heading, whatever the phone mount', () => {
    // 20 → 10 m/s in 1 s: about 1 g of braking.
    expect(gFrom({speedMps: 20, headingDeg: 90, at: 0}, {speedMps: 10, headingDeg: 90, at: 1000})?.lon).toBeCloseTo(-1.02, 2);
    // 15 m/s turning right 20° in a second: about 0.53 g sideways.
    expect(gFrom({speedMps: 15, headingDeg: 350, at: 0}, {speedMps: 15, headingDeg: 10, at: 1000})?.lat).toBeCloseTo(0.534, 2);
    expect(gFrom({speedMps: 10, headingDeg: null, at: 0}, {speedMps: 10, headingDeg: null, at: 9000})).toBeNull();
  });

  it('places the G dot, speeding up toward the top and keeping it inside the rim', () => {
    expect(gPoint({lon: 0.5, lat: 0}, 100)).toEqual({x: 0, y: -50});
    const rim = gPoint({lon: 0, lat: 3}, 100);
    expect(Math.hypot(rim.x, rim.y)).toBeCloseTo(100, 5);
  });

  it('suggests the next gear when revving high in a low gear, not when pushing hard', () => {
    expect(shiftUpHint(3100, '3', 'petrol', 40)).toBe('4');
    expect(shiftUpHint(2400, '3', 'petrol', 40)).toBeNull();
    expect(shiftUpHint(2600, '2', 'diesel', 40)).toBe('3');
    // Flat out: the driver wants the revs.
    expect(shiftUpHint(4500, '2', 'petrol', 90)).toBeNull();
    // Top gear, neutral or unknown: nothing to suggest.
    expect(shiftUpHint(3500, '6', 'petrol', 40)).toBeNull();
    expect(shiftUpHint(3500, 'N', 'petrol', 40)).toBeNull();
    expect(shiftUpHint(3500, null, 'petrol', 40)).toBeNull();
  });

  it('names the compass point of a heading', () => {
    expect(compassPoint(0)).toBe('N');
    expect(compassPoint(44)).toBe('NE');
    expect(compassPoint(181)).toBe('S');
    expect(compassPoint(350)).toBe('N');
    expect(compassPoint(-1)).toBeNull();
    expect(compassPoint(null)).toBeNull();
  });

  it('works out road gradient from altitude over distance, once there is enough road', () => {
    const climb = Array.from({length: 16}, (_, i) => ({d: i * 10, alt: 100 + i * 0.5 + (i % 2 ? 0.3 : -0.3)}));
    expect(gradePct(climb)).toBeCloseTo(5, 0);
    const flatThenDown = [...Array.from({length: 10}, (_, i) => ({d: i * 20, alt: 50})), ...Array.from({length: 10}, (_, i) => ({d: 200 + i * 15, alt: 50 - i * 1.2}))];
    expect(gradePct(flatThenDown)).toBeCloseTo(-8, 0);
    expect(gradePct([{d: 0, alt: 1}, {d: 10, alt: 2}, {d: 20, alt: 3}])).toBeNull();
  });
});
