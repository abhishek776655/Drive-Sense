/** At most `max` items, evenly spaced, always keeping the first and the last. */
export const thin = <T>(items: T[], max: number): T[] => {
  if (items.length <= max || max < 2) {
    return items;
  }
  const step = (items.length - 1) / (max - 1);
  return Array.from({length: max}, (_, i) => items[Math.round(i * step)]);
};
