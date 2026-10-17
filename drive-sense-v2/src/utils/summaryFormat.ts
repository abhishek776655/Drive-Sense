/** Summary drive time, as in Rovy: "12 Min" under an hour, "1h 5m" after. */
export const formatDriveTime = (seconds: number): string => {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  if (minutes < 60) {
    return `${minutes} Min`;
  }
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};
