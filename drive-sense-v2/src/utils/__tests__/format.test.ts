import {DASH, formatClock, formatDuration, formatG, formatKm, formatKmh, formatSpan} from '../format';

describe('format', () => {
  it('renders missing values as a dash, never 0', () => {
    expect(formatKmh(null)).toBe(DASH);
    expect(formatKm(undefined)).toBe(DASH);
    expect(formatG(null)).toBe(DASH);
    expect(formatDuration(null)).toBe(DASH);
  });

  it('formats real values', () => {
    expect(formatKmh(10)).toBe('36');
    expect(formatKm(4200)).toBe('4.2');
    expect(formatKm(123456)).toBe('123');
    expect(formatDuration(3720)).toBe('1h 2m');
    expect(formatClock(728)).toBe('12:08');
    expect(formatClock(3725)).toBe('1:02:05');
    expect(formatG(0.4219)).toBe('0.42');
  });
});

describe('formatSpan', () => {
  it('keeps seconds for short spans and drops them past an hour', () => {
    expect(formatSpan(45)).toBe('45s');
    expect(formatSpan(130)).toBe('2m 10s');
    expect(formatSpan(120)).toBe('2m');
    expect(formatSpan(3900)).toBe('1h 5m');
    expect(formatSpan(null)).toBe(DASH);
  });
});
