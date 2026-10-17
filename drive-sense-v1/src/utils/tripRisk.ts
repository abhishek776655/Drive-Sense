export type TripRiskLevel = 'low' | 'medium' | 'high';

/**
 * Risk tier for a trip card. Shared so the home screen and the trips list cannot disagree about
 * the same trip — they render the same card and previously carried two copies of this rule.
 */
export const resolveTripRiskLevel = ({
  eventCount,
  score,
  isCompleted,
}: {
  eventCount: number;
  score: number;
  isCompleted: boolean;
}): TripRiskLevel => {
  if (eventCount >= 3) {
    return 'high';
  }
  // A low score only counts against a finished trip; an in-progress trip is not scored yet and its
  // placeholder 0 would otherwise read as bad driving.
  if (eventCount > 0 || (isCompleted && score < 80)) {
    return 'medium';
  }
  return 'low';
};
