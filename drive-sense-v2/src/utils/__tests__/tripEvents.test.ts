import {countEvents, eventBreakdown, eventRatio, mappableEvents, scoreTone, scoreVerdict} from '../tripEvents';

const event = (event_type: string, latitude: number | null = 28.6) => ({
  id: `${event_type}-${latitude}`,
  event_type,
  intensity: 1.2,
  occurred_at: '2026-10-10T10:00:00Z',
  latitude,
  longitude: latitude == null ? null : 77.2,
});

describe('trip events', () => {
  it('counts events by kind and ignores unknown kinds', () => {
    expect(countEvents([event('harsh_brake'), event('harsh_brake'), event('overspeed'), event('mystery')])).toEqual({
      rapid_acceleration: 0,
      harsh_brake: 2,
      overspeed: 1,
    });
  });

  it('only maps events with a known kind and a location', () => {
    expect(mappableEvents([event('harsh_brake'), event('overspeed', null), event('mystery')])).toEqual([
      {id: 'harsh_brake-28.6', kind: 'harsh_brake', latitude: 28.6, longitude: 77.2},
    ]);
  });

  it('bands the score like the old app', () => {
    expect(scoreTone(95)).toBe('green');
    expect(scoreTone(75)).toBe('amber');
    expect(scoreTone(40)).toBe('red');
    expect(scoreVerdict(90)).toBe('Smooth and safe');
  });
});

describe('eventBreakdown', () => {
  const ev = (event_type: string, intensity: number | null, at: string) => ({id: at, event_type, intensity, occurred_at: at, latitude: 28.6, longitude: 77.2});

  it('counts each kind, marks hard ones and lists events in time order', () => {
    const b = eventBreakdown([
      ev('harsh_brake', 1.1, '2026-10-11T14:05:00Z'),
      ev('rapid_acceleration', 1.4, '2026-10-11T14:01:00Z'),
      ev('rapid_acceleration', 1.0, '2026-10-11T14:03:00Z'),
      ev('harsh_brake', 1.6, '2026-10-11T14:02:00Z'),
      ev('overspeed', 1.05, '2026-10-11T14:04:00Z'),
      ev('mystery', 2, '2026-10-11T14:06:00Z'),
    ]);
    expect(b.rapid_acceleration).toEqual({count: 2, hard: 1});
    expect(b.harsh_brake).toEqual({count: 2, hard: 1});
    expect(b.overspeed).toEqual({count: 1, hard: 0});
    expect(b.list.map((e) => e.kind)).toEqual(['rapid_acceleration', 'harsh_brake', 'rapid_acceleration', 'overspeed', 'harsh_brake']);
  });
});

describe('legacy event names', () => {
  const ev = (event_type: string, intensity: number | null) => ({id: event_type, event_type, intensity, occurred_at: '2026-10-11T14:00:00Z', latitude: null, longitude: null});

  it('reads the old brake / accel names as their current kinds', () => {
    expect(countEvents([ev('brake', 0.9), ev('accel', 0.7)])).toEqual({rapid_acceleration: 1, harsh_brake: 1, overspeed: 0});
  });

  it('only treats small intensities as a ratio of the limit', () => {
    expect(eventRatio(1.4)).toBe(1.4);
    expect(eventRatio(120)).toBeNull();
    expect(eventRatio(null)).toBeNull();
    expect(eventBreakdown([ev('overspeed', 120)]).overspeed.hard).toBe(0);
  });
});
