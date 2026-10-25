/** Cluster accents (spec 2026-10-25, cluster mode): the glow colour of every arc. Always on dark. */
export const CLUSTER_ACCENTS = {
  orange: '#FF7A1A',
  blue: '#2E9BFF',
  teal: '#19D3C5',
  red: '#FF3B4A',
  purple: '#B45CFF',
} as const;

export type ClusterAccent = keyof typeof CLUSTER_ACCENTS | 'auto';

/** The cluster's fixed dark palette; layouts never read the app theme. */
export const CLUSTER_INK = {
  background: '#030406',
  face: '#0B0E13',
  faceEdge: '#12161D',
  track: 'rgba(255,255,255,0.07)',
  tick: 'rgba(255,255,255,0.32)',
  text: '#F2F5FA',
  textDim: 'rgba(242,245,250,0.55)',
  textFaint: 'rgba(242,245,250,0.32)',
  red: '#FF3B4A',
  amber: '#FFB340',
  green: '#34E07A',
  glass: 'rgba(22,26,34,0.62)',
  glassEdge: 'rgba(255,255,255,0.09)',
  chip: 'rgba(255,255,255,0.1)',
  onSwatch: '#000000',
} as const;

/** 'auto' follows the Drive tab's speedometer accent. */
export const accentColor = (accent: ClusterAccent, driveAccent: string): string => (accent === 'auto' ? driveAccent : CLUSTER_ACCENTS[accent]);

/** How the dials show their value: a glowing arc, a needle, or a ring of LED segments. */
export const DIAL_STYLES = ['arc', 'needle', 'segment'] as const;
export type DialStyle = (typeof DIAL_STYLES)[number];
export const DIAL_STYLE_NAMES: Record<DialStyle, string> = {arc: 'Arc', needle: 'Needle', segment: 'LED'};

/**
 * How fuel and coolant show: curved arcs hugging the dials, or in the bottom strip as a segmented
 * bar, a small ring, or just the figure.
 */
export const GAUGE_STYLES = ['arc', 'bar', 'ring', 'digits'] as const;
export type GaugeStyle = (typeof GAUGE_STYLES)[number];

/** What the right dial shows without the adapter, rolled through by swiping up or down on it. */
export const PHONE_DIALS = ['g', 'climb', 'compass', 'speed'] as const;
export type PhoneDial = (typeof PHONE_DIALS)[number];
export const PHONE_DIAL_NAMES: Record<PhoneDial, string> = {g: 'G-force', climb: 'Climb', compass: 'Compass', speed: 'Speed'};
