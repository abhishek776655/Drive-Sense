/** Missing data reads as a dash, never as 0: a real 0 would be a claim. */
export const DASH = '–';

const isNum = (n: number | null | undefined): n is number => n != null && Number.isFinite(n);

export const mpsToKmh = (mps: number | null | undefined): number | null => (isNum(mps) ? mps * 3.6 : null);

export const formatInt = (n: number | null | undefined): string => (isNum(n) ? String(Math.round(n)) : DASH);

export const formatKmh = (mps: number | null | undefined): string => formatInt(mpsToKmh(mps));

export const formatKm = (meters: number | null | undefined): string => {
  if (!isNum(meters)) {
    return DASH;
  }
  const km = meters / 1000;
  return km >= 100 ? String(Math.round(km)) : km.toFixed(1);
};

export const formatDuration = (seconds: number | null | undefined): string => {
  if (!isNum(seconds)) {
    return DASH;
  }
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

/** Live timer: mm:ss under an hour, h:mm:ss after. */
export const formatClock = (seconds: number): string => {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (v: number) => String(v).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

export const formatG = (g: number | null | undefined): string => (isNum(g) ? g.toFixed(2) : DASH);

export const formatMeters = (m: number | null | undefined): string => formatInt(m);

/** Short span with seconds for short ones: 45s, 2m 10s, 1h 5m. */
export const formatSpan = (seconds: number | null | undefined): string => {
  if (!isNum(seconds)) {
    return DASH;
  }
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  if (m > 0) {
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  return `${s}s`;
};
