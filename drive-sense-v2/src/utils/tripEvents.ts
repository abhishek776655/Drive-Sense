import type {TripEvent} from '../services/tripService';

export type EventKind = 'rapid_acceleration' | 'harsh_brake' | 'overspeed' | 'sharp_turn';

export const EVENT_KINDS: EventKind[] = ['rapid_acceleration', 'harsh_brake', 'overspeed', 'sharp_turn'];

export const EVENT_LABEL: Record<EventKind, string> = {
  rapid_acceleration: 'Accel',
  harsh_brake: 'Brake',
  overspeed: 'Speeding',
  sharp_turn: 'Sharp turn',
};

/** Older trips (and the demo seed) use these names for the same events. */
const LEGACY_KIND: Record<string, EventKind> = {accel: 'rapid_acceleration', brake: 'harsh_brake'};

/** The event's kind, or null for a type the app does not know. */
export const eventKind = (eventType: string): EventKind | null =>
  EVENT_KINDS.includes(eventType as EventKind) ? (eventType as EventKind) : (LEGACY_KIND[eventType] ?? null);

/**
 * Intensity as a multiple of the event's limit. Server-detected events store that ratio; some
 * older records store a raw speed instead, which is not a ratio and is not shown as one.
 */
export const eventRatio = (intensity: number | null): number | null => (intensity != null && intensity > 0 && intensity < 10 ? intensity : null);

export const countEvents = (events: TripEvent[]): Record<EventKind, number> => {
  const counts: Record<EventKind, number> = {rapid_acceleration: 0, harsh_brake: 0, overspeed: 0, sharp_turn: 0};
  for (const event of events) {
    const kind = eventKind(event.event_type);
    if (kind) {
      counts[kind] += 1;
    }
  }
  return counts;
};

/** Events that can be drawn on a map: known kind and a location. */
export const mappableEvents = (events: TripEvent[]) =>
  events.flatMap((event) => {
    const kind = eventKind(event.event_type);
    return event.latitude != null && event.longitude != null && kind ? [{id: event.id, kind, latitude: event.latitude, longitude: event.longitude}] : [];
  });

/** Score bands, as in the old app: colour carries the verdict. */
export type ScoreTone = 'green' | 'amber' | 'red';
export const scoreTone = (score: number): ScoreTone => (score >= 90 ? 'green' : score >= 70 ? 'amber' : 'red');

export const scoreVerdict = (score: number): string =>
  score >= 90 ? 'Smooth and safe' : score >= 70 ? 'A few rough moments' : 'Lots of harsh driving';

/** Intensity is the reading ÷ the event threshold; this far over it counts as hard. */
export const HARD_INTENSITY = 1.3;

export interface TripEventItem {
  id: string;
  kind: EventKind;
  at: number;
  /** Multiple of the event's limit, when known. */
  intensity: number | null;
  latitude: number | null;
  longitude: number | null;
}

export type EventBreakdown = Record<EventKind, {count: number; hard: number}> & {list: TripEventItem[]};

/** Counts per kind (with hard ones), and every known event in time order. */
export const eventBreakdown = (events: TripEvent[]): EventBreakdown => {
  const list = events
    .flatMap((e) => {
      const kind = eventKind(e.event_type);
      return kind ? [{id: e.id, kind, at: Date.parse(e.occurred_at), intensity: eventRatio(e.intensity), latitude: e.latitude, longitude: e.longitude}] : [];
    })
    .sort((a, b) => a.at - b.at);
  const tally = (kind: EventKind) => {
    const mine = list.filter((e) => e.kind === kind);
    return {count: mine.length, hard: mine.filter((e) => (e.intensity ?? 0) >= HARD_INTENSITY).length};
  };
  return {rapid_acceleration: tally('rapid_acceleration'), harsh_brake: tally('harsh_brake'), overspeed: tally('overspeed'), sharp_turn: tally('sharp_turn'), list};
};
