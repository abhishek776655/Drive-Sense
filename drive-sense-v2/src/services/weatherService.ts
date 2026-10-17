/**
 * Open-Meteo (no API key), called from the phone. Coordinates are rounded to 2 decimals (~1 km)
 * before they leave the device.
 */
export type WeatherTone = 'good' | 'care' | 'poor';

/** Why the driving tag says what it says; the card words it (with numbers in the chosen units). */
export type DrivingReason =
  | 'storm'
  | 'heavyRain'
  | 'heavySnow'
  | 'veryLowVisibility'
  | 'strongWind'
  | 'fog'
  | 'wet'
  | 'snow'
  | 'hazy'
  | 'gusty'
  | 'rainLater'
  | 'lowSun'
  | 'night'
  | 'clear';

export interface Weather {
  city: string | null;
  temperatureC: number;
  highC: number;
  lowC: number;
  code: number;
  isDay: boolean;
  condition: string;
  tag: {tone: WeatherTone; reason: DrivingReason};
  /** Now: metres and km/h (null when the forecast leaves it out). */
  visibilityM: number | null;
  windKmh: number | null;
  /** Today's highest chance of rain, 0–100. */
  rainChance: number | null;
  /** Local times as "YYYY-MM-DDTHH:mm" in the place's time zone. */
  sunrise: string | null;
  sunset: string | null;
}

const CONDITIONS: [number[], string][] = [
  [[0], 'Clear'],
  [[1, 2], 'Partly Cloudy'],
  [[3], 'Overcast'],
  [[45, 48], 'Fog'],
  [[51, 53, 55, 56, 57], 'Drizzle'],
  [[61, 63, 66, 80, 81], 'Rain'],
  [[65, 67, 82], 'Heavy Rain'],
  [[71, 73, 75, 77, 85, 86], 'Snow'],
  [[95, 96, 99], 'Thunderstorm'],
];

export const conditionFor = (code: number, isDay: boolean): string => {
  const match = CONDITIONS.find(([codes]) => codes.includes(code))?.[1] ?? 'Unknown';
  if (match === 'Clear') {
    return isDay ? 'Clear Sky' : 'Clear Night';
  }
  return match;
};

/** Low sun this close to sunset (minutes) dazzles drivers heading west. */
const LOW_SUN_MINUTES = 45;

/**
 * Pure rule table, worst first: weather code, visibility (m), wind (km/h), today's rain chance and
 * the light to one driving tag with its reason.
 */
export const drivingTag = (
  code: number,
  visibilityM: number | null,
  windKmh: number | null,
  context: {rainChance?: number | null; isDay?: boolean; minutesToSunset?: number | null} = {},
): {tone: WeatherTone; reason: DrivingReason} => {
  if ([95, 96, 99].includes(code)) {
    return {tone: 'poor', reason: 'storm'};
  }
  if ([65, 67, 82].includes(code)) {
    return {tone: 'poor', reason: 'heavyRain'};
  }
  if ([75, 86].includes(code)) {
    return {tone: 'poor', reason: 'heavySnow'};
  }
  if (visibilityM != null && visibilityM < 1000) {
    return {tone: 'poor', reason: 'veryLowVisibility'};
  }
  if (windKmh != null && windKmh >= 60) {
    return {tone: 'poor', reason: 'strongWind'};
  }
  if ([45, 48].includes(code)) {
    return {tone: 'care', reason: 'fog'};
  }
  if ([51, 53, 55, 56, 57, 61, 63, 66, 80, 81].includes(code)) {
    return {tone: 'care', reason: 'wet'};
  }
  if ([71, 73, 77, 85].includes(code)) {
    return {tone: 'care', reason: 'snow'};
  }
  if (visibilityM != null && visibilityM < 5000) {
    return {tone: 'care', reason: 'hazy'};
  }
  if (windKmh != null && windKmh >= 35) {
    return {tone: 'care', reason: 'gusty'};
  }
  if (context.rainChance != null && context.rainChance >= 60) {
    return {tone: 'care', reason: 'rainLater'};
  }
  if (context.isDay && context.minutesToSunset != null && context.minutesToSunset >= 0 && context.minutesToSunset <= LOW_SUN_MINUTES) {
    return {tone: 'care', reason: 'lowSun'};
  }
  if (context.isDay === false) {
    return {tone: 'good', reason: 'night'};
  }
  return {tone: 'good', reason: 'clear'};
};

/** "2026-10-17T17:45" (the place's local time) to minutes from now; null if unreadable. */
export const minutesUntil = (localTime: string | null | undefined, now: Date = new Date()): number | null => {
  if (!localTime) {
    return null;
  }
  const at = new Date(localTime);
  return Number.isNaN(at.getTime()) ? null : Math.round((at.getTime() - now.getTime()) / 60000);
};

export const roundCoord = (value: number) => Math.round(value * 100) / 100;

type OpenMeteoResponse = {
  current: {temperature_2m: number; weather_code: number; is_day: number; wind_speed_10m: number; visibility?: number};
  daily: {temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max?: (number | null)[]; sunrise?: string[]; sunset?: string[]};
};

export const weatherService = {
  fetch: async (latitude: number, longitude: number, city: string | null): Promise<Weather> => {
    const params = new URLSearchParams({
      latitude: String(roundCoord(latitude)),
      longitude: String(roundCoord(longitude)),
      current: 'temperature_2m,weather_code,is_day,wind_speed_10m,visibility',
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset',
      forecast_days: '1',
      timezone: 'auto',
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
    if (!response.ok) {
      throw new Error('Weather unavailable');
    }
    const data = (await response.json()) as OpenMeteoResponse;
    const {current, daily} = data;
    const isDay = current.is_day === 1;
    const rainChance = daily.precipitation_probability_max?.[0] ?? null;
    const sunset = daily.sunset?.[0] ?? null;
    return {
      city,
      temperatureC: Math.round(current.temperature_2m),
      highC: Math.round(daily.temperature_2m_max[0]),
      lowC: Math.round(daily.temperature_2m_min[0]),
      code: current.weather_code,
      isDay,
      condition: conditionFor(current.weather_code, isDay),
      tag: drivingTag(current.weather_code, current.visibility ?? null, current.wind_speed_10m, {rainChance, isDay, minutesToSunset: minutesUntil(sunset)}),
      visibilityM: current.visibility ?? null,
      windKmh: current.wind_speed_10m ?? null,
      rainChance,
      sunrise: daily.sunrise?.[0] ?? null,
      sunset,
    };
  },
};
