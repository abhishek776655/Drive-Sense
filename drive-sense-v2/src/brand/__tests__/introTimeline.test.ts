import {introTimeline} from '../introTimeline';

describe('intro timeline', () => {
  it('finishes within 1.8 s, after the road and the wordmark have settled', () => {
    const t = introTimeline(false);
    expect(t.holdMs + t.fadeMs).toBeLessThanOrEqual(1800);
    expect(t.driveMs).toBeLessThanOrEqual(t.holdMs);
    expect(t.riseDelayMs + t.riseMs).toBeLessThanOrEqual(t.holdMs);
  });

  it('drives a whole number of dash periods, so the road comes to rest as drawn on the icon', () => {
    expect(Number.isInteger(introTimeline(false).dashPeriods)).toBe(true);
    expect(introTimeline(false).dashPeriods).toBeGreaterThan(0);
  });

  it('does not move with Reduce Motion on', () => {
    const t = introTimeline(true);
    expect(t).toMatchObject({dashPeriods: 0, driveMs: 0, riseMs: 0});
    expect(t.holdMs + t.fadeMs).toBeLessThanOrEqual(1000);
  });
});
