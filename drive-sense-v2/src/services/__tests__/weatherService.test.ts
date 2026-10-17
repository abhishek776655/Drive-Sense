import {conditionFor, drivingTag, minutesUntil, roundCoord, type Weather} from '../weatherService';
import {drivingTipText, weatherFacts} from '../../utils/weatherAdvice';

describe('weather', () => {
  it('rounds coordinates to ~1 km before sending', () => {
    expect(roundCoord(28.613912)).toBe(28.61);
    expect(roundCoord(-77.20951)).toBe(-77.21);
  });

  it('names clear sky by day and night', () => {
    expect(conditionFor(0, true)).toBe('Clear Sky');
    expect(conditionFor(0, false)).toBe('Clear Night');
    expect(conditionFor(63, true)).toBe('Rain');
  });

  it('tags driving conditions in three tones', () => {
    expect(drivingTag(0, 20000, 10).tone).toBe('good');
    expect(drivingTag(61, 20000, 10).tone).toBe('care');
    expect(drivingTag(0, 3000, 10).tone).toBe('care');
    expect(drivingTag(0, 20000, 40).tone).toBe('care');
    expect(drivingTag(95, 20000, 10).tone).toBe('poor');
    expect(drivingTag(0, 500, 10).tone).toBe('poor');
    expect(drivingTag(0, 20000, 70).tone).toBe('poor');
  });

  it('says why, worst first', () => {
    expect(drivingTag(95, 500, 80).reason).toBe('storm');
    expect(drivingTag(45, 20000, 10).reason).toBe('fog');
    expect(drivingTag(61, 20000, 10).reason).toBe('wet');
    expect(drivingTag(0, 3000, 10).reason).toBe('hazy');
    expect(drivingTag(0, 20000, 40).reason).toBe('gusty');
    expect(drivingTag(0, 20000, 10, {rainChance: 70}).reason).toBe('rainLater');
    expect(drivingTag(0, 20000, 10, {isDay: true, minutesToSunset: 30})).toEqual({tone: 'care', reason: 'lowSun'});
    expect(drivingTag(0, 20000, 10, {isDay: false})).toEqual({tone: 'good', reason: 'night'});
    expect(drivingTag(0, 20000, 10, {isDay: true, minutesToSunset: 300}).reason).toBe('clear');
  });

  it('counts minutes to a local time', () => {
    expect(minutesUntil('2026-10-17T18:00', new Date(2026, 9, 17, 17, 30))).toBe(30);
    expect(minutesUntil(null)).toBeNull();
    expect(minutesUntil('soon')).toBeNull();
  });

  it('words the tip and facts in the chosen units', () => {
    const w = {tag: {tone: 'care', reason: 'hazy'}, visibilityM: 3200, windKmh: 38, rainChance: 20} as Weather;
    expect(drivingTipText(w, 'metric')).toBe('Hazy · 3.2 km visibility');
    expect(drivingTipText({...w, tag: {tone: 'care', reason: 'gusty'}}, 'imperial')).toBe('Gusty wind · 24 mph');
    // Hazy already states the visibility, so the facts skip it.
    expect(weatherFacts(w, 'metric').map((f) => f.text)).toEqual(['38 km/h', '20%']);
    const clear = {...w, tag: {tone: 'good', reason: 'clear'}} as Weather;
    expect(weatherFacts(clear, 'metric').map((f) => f.text)).toEqual(['3.2 km', '38 km/h', '20%']);
    expect(weatherFacts({...clear, rainChance: null}, 'metric')).toHaveLength(2);
  });
});
