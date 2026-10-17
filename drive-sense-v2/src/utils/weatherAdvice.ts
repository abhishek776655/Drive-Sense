import type {Weather} from '../services/weatherService';
import {distanceUnit, formatDistance, kmhInUnits, speedUnit, type UnitSystem} from './units';

const wind = (w: Weather, units: UnitSystem) => (w.windKmh != null ? `${kmhInUnits(w.windKmh, units)} ${speedUnit(units)}` : null);
const visibility = (w: Weather, units: UnitSystem) => (w.visibilityM != null ? `${formatDistance(w.visibilityM, units)} ${distanceUnit(units)}` : null);

/** The chip's headline: what to watch for and, where it helps, the number behind it. */
export const drivingTipText = (w: Weather, units: UnitSystem): string => {
  const join = (head: string, detail: string | null) => (detail ? `${head} · ${detail}` : head);
  switch (w.tag.reason) {
    case 'storm':
      return 'Thunderstorm · avoid driving if you can';
    case 'heavyRain':
      return 'Heavy rain · slow down, lights on';
    case 'heavySnow':
      return 'Heavy snow · only if you must';
    case 'veryLowVisibility':
      return join('Very low visibility', visibility(w, units));
    case 'strongWind':
      return join('Strong wind', wind(w, units));
    case 'fog':
      return 'Fog · low beams, extra distance';
    case 'wet':
      return 'Wet roads · keep your distance';
    case 'snow':
      return 'Snow · brake early, go gently';
    case 'hazy':
      return join('Hazy', visibility(w, units) ? `${visibility(w, units)} visibility` : null);
    case 'gusty':
      return join('Gusty wind', wind(w, units));
    case 'rainLater':
      return join('Rain likely later', w.rainChance != null ? `${w.rainChance}%` : null);
    case 'lowSun':
      return 'Low sun soon · watch for glare';
    case 'night':
      return 'Clear night · headlights on';
    default:
      return 'Good for driving';
  }
};

/** Small facts under the headline, in the chosen units; left out when unknown or already in the headline. */
export const weatherFacts = (w: Weather, units: UnitSystem): {icon: 'eye' | 'flag' | 'water'; text: string}[] => {
  const said = w.tag.reason;
  return [
    {icon: 'eye' as const, text: said === 'hazy' || said === 'veryLowVisibility' ? null : visibility(w, units)},
    {icon: 'flag' as const, text: said === 'gusty' || said === 'strongWind' ? null : wind(w, units)},
    {icon: 'water' as const, text: said === 'rainLater' || w.rainChance == null ? null : `${w.rainChance}%`},
  ].filter((f): f is {icon: 'eye' | 'flag' | 'water'; text: string} => f.text != null);
};
