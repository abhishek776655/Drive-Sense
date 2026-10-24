import {adapterConfirms, type AdapterTrace} from '../eventCheck';

const T = 100_000;
const trace = (kmh: number[], start = T - 2000): AdapterTrace => kmh.map((v, i) => ({t: start + i * 1000, kmh: v}));

describe('adapter cross-check', () => {
  // GPS: 20 m/s to 13 m/s in one second (-7 m/s², a "harsh brake").
  const a = {timestamp: T, speedMps: 20};
  const b = {timestamp: T + 1000, speedMps: 13};

  it('confirms a real stop', () => {
    expect(adapterConfirms(a, b, trace([72, 72, 70, 50, 46, 45]))).toBe(true);
  });

  it('rejects a GPS jump the wheels never felt', () => {
    expect(adapterConfirms(a, b, trace([72, 72, 71, 72, 72, 71]))).toBe(false);
  });

  it('needs the change in the same direction', () => {
    // The adapter sped up while GPS says it braked.
    expect(adapterConfirms(a, b, trace([50, 55, 60, 65, 70, 72]))).toBe(false);
  });

  it('confirms acceleration the same way', () => {
    expect(adapterConfirms({timestamp: T, speedMps: 5}, {timestamp: T + 1000, speedMps: 9}, trace([18, 18, 20, 30, 32, 33]))).toBe(true);
  });

  it('has no say without adapter readings around the event', () => {
    expect(adapterConfirms(a, b, [])).toBeNull();
    expect(adapterConfirms(a, b, trace([72], T))).toBeNull();
    expect(adapterConfirms(a, b, trace([72, 70], T + 60_000))).toBeNull();
  });
});
