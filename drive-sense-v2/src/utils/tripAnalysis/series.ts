import {speedColor, type SpeedScaleColors} from '../speedColor';
import {segments, type CleanPoint} from './prepare';
import {thin} from './thin';

export const MAP_POINTS = 500;
export const CHART_SAMPLES = 200;
/** Speeds within the same 5 km/h step share a colour, so the route draws as a few long lines. */
const BUCKET_KMH = 5;

export interface ColoredLine {
  key: string;
  color: string;
  coords: {latitude: number; longitude: number}[];
}

/** The route as polylines coloured by speed; each line starts where the previous one ended. */
export const speedSegments = (points: CleanPoint[], colors: SpeedScaleColors, max = MAP_POINTS): ColoredLine[] => {
  const lines: ColoredLine[] = [];
  let bucket: number | null = null;
  for (const s of segments(thin(points, max))) {
    const b = Math.floor(s.kmh / BUCKET_KMH);
    const to = {latitude: s.to.latitude, longitude: s.to.longitude};
    if (b === bucket && lines.length > 0) {
      lines[lines.length - 1].coords.push(to);
    } else {
      bucket = b;
      lines.push({
        key: `${lines.length}`,
        color: speedColor(b * BUCKET_KMH + BUCKET_KMH / 2, colors),
        coords: [{latitude: s.from.latitude, longitude: s.from.longitude}, to],
      });
    }
  }
  return lines;
};

export interface SpeedSample {
  t: number;
  kmh: number;
}

/** Speed over time for the chart, capped in length; the peak is always kept. */
export const speedSeries = (points: CleanPoint[], max = CHART_SAMPLES): {samples: SpeedSample[]; peak: SpeedSample | null} => {
  const all = points.map((p) => ({t: p.t, kmh: p.mps * 3.6}));
  if (all.length === 0) {
    return {samples: [], peak: null};
  }
  const peak = all.reduce((best, s) => (s.kmh > best.kmh ? s : best), all[0]);
  const samples = thin(all, max);
  if (!samples.includes(peak)) {
    samples.push(peak);
    samples.sort((a, b) => a.t - b.t);
  }
  return {samples, peak};
};
