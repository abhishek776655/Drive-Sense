import type {StatId} from '../stores/driveSettingsStore';
import type {LiveStats} from '../stores/recordingStore';
import {avgSpeedMps} from '../stores/recordingStore';
import {DASH, formatClock, formatG, formatInt} from './format';
import {formatHeading} from './heading';
import {liveScore} from './liveScore';
import {scoreTone} from './tripEvents';
import type {Smoothness} from './motion';
import {distanceUnit, formatDistance, formatSpeed, speedUnit, type UnitSystem} from './units';

export type StatTone = 'blue' | 'accent' | 'purple' | 'teal' | 'amber' | 'green' | 'cyan' | 'mint';

export interface StatDisplay {
  id: StatId;
  /** Gauge tile label. */
  label: string;
  /** Map sheet label, under the value. */
  short: string;
  value: string;
  unit: string;
  icon: string;
  tone: StatTone;
  /** Colours the value itself (smoothness band); icon-only otherwise. */
  valueTone?: 'green' | 'amber' | 'red';
}

/** Distance and avg speed get their `short` (the unit) in `statDisplay`. */
export const STAT_META: Record<StatId, {label: string; short: string; icon: string; tone: StatTone; pickerLabel: string}> = {
  distance: {label: 'DIST', short: '', icon: 'git-commit', tone: 'blue', pickerLabel: 'Distance'},
  time: {label: 'TIME', short: 'TIME', icon: 'time', tone: 'cyan', pickerLabel: 'Time'},
  avgSpeed: {label: 'AVG', short: '', icon: 'speedometer', tone: 'accent', pickerLabel: 'Avg speed'},
  topSpeed: {label: 'TOP', short: 'TOP', icon: 'flame', tone: 'accent', pickerLabel: 'Top speed'},
  maxG: {label: 'MAX G', short: 'MAX G', icon: 'magnet', tone: 'purple', pickerLabel: 'Max G'},
  liveG: {label: 'G', short: 'G', icon: 'pulse', tone: 'purple', pickerLabel: 'Live G'},
  altitude: {label: 'ALT', short: 'ALT M', icon: 'triangle', tone: 'teal', pickerLabel: 'Altitude'},
  elevationGain: {label: 'GAIN', short: 'GAIN M', icon: 'trending-up', tone: 'mint', pickerLabel: 'Elevation gain'},
  heading: {label: 'HEADING', short: 'HDG', icon: 'compass', tone: 'blue', pickerLabel: 'Heading'},
  events: {label: 'EVENTS', short: 'EVENTS', icon: 'warning', tone: 'amber', pickerLabel: 'Events'},
  liveScore: {label: 'SCORE', short: 'SCORE', icon: 'ribbon', tone: 'green', pickerLabel: 'Live score'},
  smoothness: {label: 'SMOOTH', short: 'SMOOTH', icon: 'pulse', tone: 'green', pickerLabel: 'Smoothness'},
  accuracy: {label: 'GPS', short: 'GPS ±M', icon: 'locate', tone: 'cyan', pickerLabel: 'GPS accuracy'},
};

const SMOOTHNESS_LABEL: Record<Smoothness, string> = {smooth: 'Smooth', moderate: 'Moderate', harsh: 'Harsh'};
const SMOOTHNESS_TONE: Record<Smoothness, 'green' | 'amber' | 'red'> = {smooth: 'green', moderate: 'amber', harsh: 'red'};

/** Live values for each stat slot, in the chosen units. Anything without data reads "–". */
export const statDisplay = (id: StatId, stats: LiveStats, elapsedS: number, units: UnitSystem): StatDisplay => {
  const meta = STAT_META[id];
  const base = {id, label: meta.label, short: meta.short, icon: meta.icon, tone: meta.tone};
  switch (id) {
    case 'distance':
      return {...base, short: distanceUnit(units).toUpperCase(), value: formatDistance(stats.distanceM, units), unit: distanceUnit(units)};
    case 'time':
      return {...base, value: formatClock(elapsedS), unit: ''};
    case 'avgSpeed':
      return {...base, short: `Ø ${speedUnit(units).toUpperCase()}`, value: formatSpeed(avgSpeedMps(stats.distanceM, stats.movingSeconds), units), unit: speedUnit(units)};
    case 'topSpeed':
      return {...base, value: formatSpeed(stats.topSpeedMps, units), unit: speedUnit(units)};
    case 'maxG':
      return {...base, value: formatG(stats.maxG), unit: 'G'};
    case 'liveG':
      return {...base, value: formatG(stats.liveG), unit: 'G'};
    case 'altitude':
      return {...base, value: formatInt(stats.altitudeM), unit: 'm'};
    case 'elevationGain':
      return {...base, value: formatInt(stats.elevationGainM), unit: 'm'};
    case 'heading':
      // Only meaningful while moving: a parked car's GPS course is noise.
      return {...base, value: stats.moving && stats.headingDeg != null ? formatHeading(stats.headingDeg) : DASH, unit: ''};
    case 'smoothness': {
      const band = stats.smoothness;
      return {...base, value: band ? SMOOTHNESS_LABEL[band] : DASH, unit: '', valueTone: band ? SMOOTHNESS_TONE[band] : undefined};
    }
    case 'accuracy':
      return {...base, value: stats.accuracyM != null ? `±${Math.round(stats.accuracyM)}` : DASH, unit: 'm'};
    case 'events':
      return {...base, value: String(stats.eventCount), unit: ''};
    case 'liveScore': {
      // Same formula as the server; before the first fix there is nothing to score yet.
      const score = elapsedS > 0 ? liveScore(stats) : null;
      return {...base, value: score != null ? String(score) : DASH, unit: '', valueTone: score != null ? scoreTone(score) : undefined};
    }
  }
};
