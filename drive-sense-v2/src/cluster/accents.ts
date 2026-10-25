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
