import {isoDay, monthRange, monthWeeks, pickDay, rangeLabel} from '../calendar';

describe('calendar utils', () => {
  it('formats local days without shifting through UTC', () => {
    expect(isoDay(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });

  it('lays a month out in Monday-first weeks', () => {
    // October 2026 starts on a Thursday and has 31 days.
    const weeks = monthWeeks(2026, 9);
    expect(weeks[0].slice(0, 3)).toEqual([null, null, null]);
    expect(weeks[0][3]?.getDate()).toBe(1);
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });

  it('gives a month as its first and last day', () => {
    expect(monthRange(2026, 1)).toEqual({start: '2026-02-01', end: '2026-02-28'});
  });

  it('labels ranges briefly', () => {
    expect(rangeLabel({start: '2026-10-01', end: '2026-10-31'})).toBe('Oct 2026');
    expect(rangeLabel({start: '2026-10-03', end: '2026-10-17'})).toBe('3–17 Oct');
    expect(rangeLabel({start: '2026-09-28', end: '2026-10-03'})).toBe('28 Sept – 3 Oct');
    expect(rangeLabel({start: '2026-10-03', end: '2026-10-03'})).toBe('3 Oct');
    expect(rangeLabel({start: '2025-12-28', end: '2026-01-03'})).toContain('2025');
  });

  it('picks a start, then an end, and starts over when needed', () => {
    const started = pickDay({start: null, end: null}, '2026-10-05');
    expect(started).toEqual({start: '2026-10-05', end: null});
    expect(pickDay(started, '2026-10-09')).toEqual({start: '2026-10-05', end: '2026-10-09'});
    expect(pickDay(started, '2026-10-01')).toEqual({start: '2026-10-01', end: null});
    expect(pickDay({start: '2026-10-05', end: '2026-10-09'}, '2026-10-20')).toEqual({start: '2026-10-20', end: null});
  });
});
