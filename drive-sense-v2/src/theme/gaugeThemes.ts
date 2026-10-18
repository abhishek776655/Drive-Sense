/**
 * Fixed colours of the vehicle-themed speedometer dials (`ThemedGauges`). They are the dials' own
 * paint, the same in light and dark mode like a real instrument, so they live here rather than in
 * the app palettes.
 */
export type NeedleTheme = {
  face: string;
  /** Lighter centre of the face (a soft radial lift); defaults to the face. */
  faceInner?: string;
  rim: string;
  /** The arc's colours from 0 to full scale; the unlit part is drawn faint. */
  arc: string[];
  tick: string;
  number: string;
  needle: string;
  hub: string;
  /** F1: a row of shift lights at the top, lit as the speed climbs. */
  shiftLights?: boolean;
};

export type RoadTheme = {sky: [string, string]; ground: [string, string]; road: string; line: string; light: 'moon' | 'sun' | 'sunset'};

/** Shared bits: F1 shift lights, the road scenes' moon, sun and rim. */
export const GAUGE_INK = {
  shiftGreen: '#2BD35A',
  shiftYellow: '#FFD60A',
  shiftRed: '#FF453A',
  moon: '#F2F4FF',
  sun: '#FFE27A',
  sunset: '#FFB25C',
  rim: '#FFFFFF',
};

/** Rovy's vehicle dials. */
export const NEEDLE_THEMES = {
  classic: {face: '#13261E', faceInner: '#1E3A2E', rim: '#3D5E50', arc: ['#2BD35A', '#A8F0C0', '#FFFFFF'], tick: '#9FC7B4', number: '#C9E4D8', needle: '#FFFFFF', hub: '#2BD35A'},
  sport: {face: '#111114', faceInner: '#1E1E24', rim: '#3A3A42', arc: ['#FFFFFF', '#FF9F0A', '#FF3B30'], tick: '#C7C7CC', number: '#E5E5EA', needle: '#FF3B30', hub: '#FF3B30'},
  luxury: {face: '#0B0B0D', faceInner: '#1C1C20', rim: '#8E8E93', arc: ['#D1D1D6', '#FFFFFF'], tick: '#AEAEB2', number: '#D1D1D6', needle: '#E5E5EA', hub: '#8E8E93'},
  vintage: {face: '#E9DFC6', faceInner: '#F6EEDC', rim: '#9C7A4E', arc: ['#C9A97A', '#8A5A2B'], tick: '#5C4630', number: '#4A3826', needle: '#2C2118', hub: '#8A5A2B'},
  rally: {face: '#0A0A0A', faceInner: '#1A1A1A', rim: '#2C2C2E', arc: ['#2BD35A', '#FFD60A', '#FF9F0A', '#FF3B30'], tick: '#E5E5EA', number: '#FFFFFF', needle: '#FFFFFF', hub: '#FF9F0A'},
  truck: {face: '#0C0F0C', faceInner: '#1B211B', rim: '#3A4A3A', arc: ['#2BD35A', '#C8E64B', '#FFD60A'], tick: '#C7D9C7', number: '#E6F2E6', needle: '#E6F2E6', hub: '#FFD60A'},
  motorcycle: {face: '#050505', faceInner: '#161616', rim: '#2C2C2E', arc: ['#FFFFFF', '#FFFFFF', '#FF453A'], tick: '#FFFFFF', number: '#FFFFFF', needle: '#FFFFFF', hub: '#FFFFFF'},
  f1: {face: '#0B0C10', faceInner: '#1B1D24', rim: '#33363F', arc: ['#30D158', '#FFD60A', '#FF9F0A', '#FF3B30'], tick: '#AEB4C2', number: '#D5DAE5', needle: '#FF3B30', hub: '#FF3B30', shiftLights: true},
  buggy: {face: '#07121A', faceInner: '#10222E', rim: '#28485A', arc: ['#30D5F0', '#5E9BFF', '#BF5AF2'], tick: '#8FD8EA', number: '#BFEFFA', needle: '#30D5F0', hub: '#30D5F0'},
  kart: {face: '#080B10', faceInner: '#151B24', rim: '#2A3340', arc: ['#0A84FF', '#30D158', '#FFD60A'], tick: '#C9D3E0', number: '#E3EAF3', needle: '#FFD60A', hub: '#FFD60A'},
  atv: {face: '#140D07', faceInner: '#26180C', rim: '#5A3A1A', arc: ['#FF9F0A', '#FF6B00'], tick: '#E8B98A', number: '#FFB35C', needle: '#FF9F0A', hub: '#FF9F0A'},
  scooter: {face: '#0A1512', faceInner: '#15261F', rim: '#2E4A3F', arc: ['#30D158', '#7BE495'], tick: '#9CC9B5', number: '#C3E6D6', needle: '#FF453A', hub: '#FF453A'},
  moped: {face: '#14100A', faceInner: '#241C12', rim: '#4A3A22', arc: ['#FFB340', '#FF9F0A'], tick: '#D9BE8C', number: '#F2D7A6', needle: '#FFB340', hub: '#FFB340'},
} satisfies Record<string, NeedleTheme>;

export const ROAD_THEMES = {
  openRoad: {sky: ['#0B1530', '#25365E'], ground: ['#0E1626', '#070B14'], road: '#262C3A', line: '#C9D2E6', light: 'moon'},
  daylightRoad: {sky: ['#3E8EE8', '#BFE2FF'], ground: ['#C9B98F', '#8E7E5A'], road: '#5A5E66', line: '#FFFFFF', light: 'sun'},
  sunsetRoad: {sky: ['#3A1C4A', '#F07A3A'], ground: ['#3A2A2E', '#1A1216'], road: '#2E2A30', line: '#FFD2A8', light: 'sunset'},
} satisfies Record<string, RoadTheme>;
