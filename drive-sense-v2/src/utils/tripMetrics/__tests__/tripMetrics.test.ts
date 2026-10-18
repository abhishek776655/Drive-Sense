import type {Sample} from '../../../stores/recordingStore';
import {detectEvents, detectTurns, estimateMaxG, idleSeconds, maxGFor, scoreFor, signedDelta, tripMetrics, type PhoneEvent} from '..';

const T0 = Date.UTC(2026, 9, 11, 8);
const fix = (seconds: number, patch: Partial<Sample> = {}): Sample => ({
  latitude: 28.6,
  longitude: 77.2,
  speedMps: 10,
  altitudeM: null,
  headingDeg: null,
  accuracyM: 5,
  timestamp: T0 + seconds * 1000,
  ...patch,
});

// The cases below are the backend's own tests (tests/unit/test_*.py), replayed on the port.
const track = (headings: number[], speed = 10, step = 1) => headings.map((h, i) => fix(i * step, {latitude: 28.6 + i * 0.0001, speedMps: speed, headingDeg: h}));

describe('turns (test_turn_detection.py)', () => {
  it('takes the short way round', () => {
    expect(signedDelta(350, 10)).toBe(20);
    expect(signedDelta(10, 350)).toBe(-20);
    expect(signedDelta(0, 90)).toBe(90);
  });
  it('counts a right turn through north, and a left turn', () => {
    expect(detectTurns(track([300, 300, 320, 345, 10, 30, 30]))).toEqual({left: 0, right: 1});
    expect(detectTurns(track([90, 90, 60, 30, 0, 0]))).toEqual({left: 1, right: 0});
  });
  it('ignores slow curves and crawling, and counts a U-turn per 60° window', () => {
    expect(detectTurns(track([0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66]))).toEqual({left: 0, right: 0});
    expect(detectTurns(track([0, 45, 90, 135, 180]))).toEqual({left: 0, right: 2});
    expect(detectTurns(track([0, 90, 180, 270], 1))).toEqual({left: 0, right: 0});
  });
  it('falls back to the bearing between fixes, and a long gap breaks the window', () => {
    const coords = [
      [28.6, 77.2],
      [28.6001, 77.2],
      [28.6002, 77.2],
      [28.6002, 77.2001],
      [28.6002, 77.2002],
    ];
    expect(detectTurns(coords.map(([lat, lon], i) => fix(i, {latitude: lat, longitude: lon})))).toEqual({left: 0, right: 1});
    expect(detectTurns([...track([0, 40]), fix(8, {latitude: 28.61, headingDeg: 80})])).toEqual({left: 0, right: 0});
  });
});

describe('events (test_driving_event_detection_service.py)', () => {
  it('reports speed and acceleration events in order', () => {
    const events = detectEvents([fix(0, {speedMps: 5}), fix(5, {speedMps: 25}), fix(10, {speedMps: 8}), fix(15, {speedMps: 33})], {
      harshBrakingMps2: -3,
      rapidAccelerationMps2: 3,
      overspeedMps: 30,
    });
    expect(events.map((e) => e.event_type)).toEqual(['rapid_acceleration', 'harsh_brake', 'overspeed', 'rapid_acceleration']);
    expect(events[2].intensity).toBe(1.1);
  });
  it('counts one overspeed per entry above the limit', () => {
    const events = detectEvents([fix(0, {speedMps: 30}), fix(1, {speedMps: 30}), fix(2, {speedMps: 20}), fix(30, {speedMps: 29})]);
    expect(events.filter((e) => e.event_type === 'overspeed')).toHaveLength(2);
  });
});

describe('score (test_driving_score_service.py)', () => {
  const ev = (event_type: PhoneEvent['event_type'], intensity = 1): PhoneEvent => ({event_type, intensity, occurred_at: '', latitude: 0, longitude: 0});
  it('applies the weights and floors the overspeed total first, like the server', () => {
    expect(scoreFor([])).toBe(100);
    expect(scoreFor([ev('harsh_brake'), ev('rapid_acceleration')])).toBe(96);
    // 15 × 1.3 = Σ 19.5, floored to 19 before the 0.1 weight: 100 − 1.9 = 98.1 → 98.
    expect(scoreFor(Array.from({length: 15}, () => ev('overspeed', 1.3)))).toBe(98);
    expect(scoreFor(Array.from({length: 80}, () => ev('harsh_brake')))).toBe(0);
  });
});

describe('G-force and idle (test_home_stats.py)', () => {
  it('estimates from GPS speed, ignoring gaps, noise and missing speeds', () => {
    expect(estimateMaxG([fix(0, {speedMps: 10}), fix(1, {speedMps: 5.095})])).toBeCloseTo(0.5, 3);
    expect(estimateMaxG([fix(0, {speedMps: 10}), fix(10, {speedMps: 0})])).toBeNull();
    expect(estimateMaxG([fix(0, {speedMps: 30}), fix(1, {speedMps: 0})])).toBeNull();
    expect(estimateMaxG([fix(0, {speedMps: null}), fix(1, {speedMps: 3})])).toBeNull();
  });
  it('prefers the sensor peak when the phone measured one', () => {
    expect(maxGFor([fix(0, {peakG: 0.3}), fix(1, {peakG: 0.62, speedMps: 2})])).toEqual({value: 0.62, source: 'sensor'});
  });
  it('adds up standing still, but not gaps without signal', () => {
    expect(idleSeconds([fix(0), fix(10, {speedMps: 0}), fix(20, {speedMps: 0.4}), fix(200, {speedMps: 0})])).toBe(20);
  });
  it('puts it all together', () => {
    expect(tripMetrics([fix(2, {speedMps: 0}), fix(0, {speedMps: 12})])).toMatchObject({score: 98, events: [{event_type: 'harsh_brake'}], idleSeconds: 2});
  });
});

describe('detectSharpTurns (the server tests for detect_sharp_turns)', () => {
  const {detectSharpTurns, scoreFor} = jest.requireActual('../index') as typeof import('../index');
  const lonPerM = 1 / (111_195 * Math.cos((28.6 * Math.PI) / 180));
  const at = (s: number, north: number, east: number, speed: number) => ({
    latitude: 28.6 + north / 111_195,
    longitude: 77.2 + east * lonPerM,
    speedMps: speed,
    altitudeM: null,
    headingDeg: null,
    accuracyM: 5,
    timestamp: Date.UTC(2026, 9, 18, 9, 0, 0) + s * 1000,
  });

  it('finds one sharp turn at the corner of a hard right turn', () => {
    const track = [...Array.from({length: 6}, (_, i) => at(i, 12 * i, 0, 12)), ...Array.from({length: 6}, (_, i) => at(6 + i, 60, 12 * (i + 1), 12))];
    const events = detectSharpTurns(track);
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe('sharp_turn');
    expect(events[0].intensity).toBeGreaterThanOrEqual(1);
  });

  it('ignores a straight road, a gentle bend and slow turns', () => {
    expect(detectSharpTurns(Array.from({length: 20}, (_, i) => at(i, 15 * i, 0.8 * (i % 2), 15)))).toEqual([]);
    let north = 0;
    let east = 0;
    const bend = Array.from({length: 20}, (_, i) => {
      const heading = (Math.min(30, Math.max(0, (i - 5) * 3)) * Math.PI) / 180;
      north += 10 * Math.cos(heading);
      east += 10 * Math.sin(heading);
      return at(i, north, east, 10);
    });
    expect(detectSharpTurns(bend)).toEqual([]);
    const slow = [...Array.from({length: 6}, (_, i) => at(i, 3 * i, 0, 3)), ...Array.from({length: 6}, (_, i) => at(6 + i, 15, 3 * (i + 1), 3))];
    expect(detectSharpTurns(slow)).toEqual([]);
  });

  it('costs a point per sharp turn', () => {
    const turn = {event_type: 'sharp_turn' as const, intensity: 1.2, occurred_at: '', latitude: 0, longitude: 0};
    expect(scoreFor([turn, turn, turn])).toBe(97);
  });
});
