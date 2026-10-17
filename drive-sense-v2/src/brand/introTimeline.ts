/** How far the road mark rises to make room for the wordmark, in points. */
export const RISE_PT = 56;

export interface IntroTimeline {
  /** Lane-dash periods the road scrolls through; whole, so it stops exactly as on the icon. */
  dashPeriods: number;
  driveMs: number;
  riseDelayMs: number;
  riseMs: number;
  /** From start until the overlay begins to fade out. */
  holdMs: number;
  fadeMs: number;
}

/** First-launch brand intro timing (spec 2026-10-17, brand logo, section 3). */
export const introTimeline = (reduceMotion: boolean): IntroTimeline =>
  reduceMotion
    ? {dashPeriods: 0, driveMs: 0, riseDelayMs: 0, riseMs: 0, holdMs: 600, fadeMs: 200}
    : {dashPeriods: 2, driveMs: 800, riseDelayMs: 550, riseMs: 450, holdMs: 1500, fadeMs: 300};
