type Point = {latitude: number; longitude: number};

/** Smallest span shown (~450 m), so a very short drive is not zoomed to a single street. */
const MIN_DELTA = 0.004;
/** Margin around the route so the start and end dots are not on the edge. */
const PADDING = 1.6;

/** Map region that shows the whole route with a margin; null for no points. */
export const routeRegion = (points: Point[]) => {
  if (points.length === 0) {
    return null;
  }
  const lats = points.map((p) => p.latitude);
  const lons = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: Math.max(MIN_DELTA, (maxLat - minLat) * PADDING),
    longitudeDelta: Math.max(MIN_DELTA, (maxLon - minLon) * PADDING),
  };
};
