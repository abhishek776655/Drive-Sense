import {getDb} from '../db';
import {cacheGet, cachePut} from '../db/repos';
import {conditionFor, drivingTag, roundCoord, type WeatherTone} from './weatherService';

/** The weather when a drive started (trip page). */
export interface TripWeather {
  temperatureC: number;
  code: number;
  isDay: boolean;
  condition: string;
  windKmh: number | null;
  humidity: number | null;
  tone: WeatherTone;
}

type Hourly = {
  hourly: {
    time: string[];
    temperature_2m: (number | null)[];
    weather_code: (number | null)[];
    wind_speed_10m: (number | null)[];
    relative_humidity_2m: (number | null)[];
    is_day?: (number | null)[];
  };
};

/** The forecast API keeps about three months of past days; older drives use the archive. */
const RECENT_DAYS = 80;

/** "Clear Night" reads better as the night it was. */
const nicer = (condition: string) => (condition === 'Clear Night' ? 'Starry Night' : condition);

/**
 * Open-Meteo's hourly weather for the hour the drive started, at its start (rounded to ~1 km).
 * Kept on the phone per trip: the past does not change, and it then shows offline.
 */
export async function tripWeather(tripId: string, latitude: number, longitude: number, startIso: string): Promise<TripWeather | null> {
  const db = getDb();
  const key = `trip-weather:${tripId}`;
  const kept = db ? cacheGet<TripWeather>(db, key) : null;
  if (kept) {
    return kept;
  }
  const start = new Date(startIso);
  const day = start.toISOString().slice(0, 10);
  const recent = Date.now() - start.getTime() < RECENT_DAYS * 86_400_000;
  const params = new URLSearchParams({
    latitude: String(roundCoord(latitude)),
    longitude: String(roundCoord(longitude)),
    hourly: 'temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m,is_day',
    start_date: day,
    end_date: day,
    timezone: 'GMT',
  });
  const host = recent ? 'https://api.open-meteo.com/v1/forecast' : 'https://archive-api.open-meteo.com/v1/archive';
  const response = await fetch(`${host}?${params.toString()}`);
  if (!response.ok) {
    return null;
  }
  const {hourly} = (await response.json()) as Hourly;
  // Times come back as "YYYY-MM-DDTHH:00" in GMT.
  const hour = `${day}T${String(start.getUTCHours()).padStart(2, '0')}:00`;
  const i = hourly.time.indexOf(hour);
  const temperature = i >= 0 ? hourly.temperature_2m[i] : null;
  const code = i >= 0 ? hourly.weather_code[i] : null;
  if (temperature == null || code == null) {
    return null;
  }
  const isDay = hourly.is_day?.[i] != null ? hourly.is_day[i] === 1 : start.getUTCHours() >= 1 && start.getUTCHours() < 13;
  const windKmh = hourly.wind_speed_10m[i] ?? null;
  const weather: TripWeather = {
    temperatureC: Math.round(temperature),
    code,
    isDay,
    condition: nicer(conditionFor(code, isDay)),
    windKmh: windKmh != null ? Math.round(windKmh) : null,
    humidity: hourly.relative_humidity_2m[i] ?? null,
    tone: drivingTag(code, null, windKmh).tone,
  };
  if (db) {
    cachePut(db, key, weather);
  }
  return weather;
}
