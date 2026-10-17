export type TrendGranularity = 'day' | 'week' | 'month';

/** Axis label per bucket: weekday initial, day of month for weeks, month initial for months. */
export const trendLabel = (bucketStart: string, granularity: TrendGranularity): string => {
  const date = new Date(bucketStart);
  if (granularity === 'week') {
    return String(date.getDate());
  }
  if (granularity === 'month') {
    return date.toLocaleDateString('en-IN', {month: 'narrow'});
  }
  return date.toLocaleDateString('en-IN', {weekday: 'narrow'});
};
