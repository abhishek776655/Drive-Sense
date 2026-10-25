import type {Sample} from '../../stores/recordingStore';
import {adapterGoverns, adapterReading, applyAdapter, carState, engineEndAt, fillGap, lastActiveAt, lastAnswerAt} from '../sourceRules';

const NOW = 1_000_000;
const fix: Sample = {latitude: 28.6, longitude: 77.2, speedMps: 10, altitudeM: null, headingDeg: null, accuracyM: 5, timestamp: NOW};

describe('adapter reading', () => {
  it('uses only fresh values', () => {
    expect(adapterReading({values: {speed: {v: 72, at: NOW - 500}, rpm: {v: 2000, at: NOW - 100}}, distanceM: 5}, NOW)).toEqual({speedMps: 20, engineOn: true, distanceM: 5});
    expect(adapterReading({values: {speed: {v: 72, at: NOW - 5000}}, distanceM: 0}, NOW)).toBeNull();
    expect(adapterReading({values: {rpm: {v: 0, at: NOW}}, distanceM: 0}, NOW)).toEqual({speedMps: null, engineOn: false, distanceM: 0});
  });
});

describe('applying the adapter to a fix', () => {
  it('takes adapter speed and engine state', () => {
    expect(applyAdapter(fix, {speedMps: 12.5, engineOn: true, distanceM: 0})).toMatchObject({speedMps: 12.5, speedSource: 'obd', engineOn: true});
  });

  it('keeps GPS speed without an adapter speed', () => {
    expect(applyAdapter(fix, null)).toMatchObject({speedMps: 10, speedSource: 'gps'});
    expect(applyAdapter(fix, null)).not.toHaveProperty('engineOn');
    expect(applyAdapter(fix, {speedMps: null, engineOn: false, distanceM: 0})).toMatchObject({speedMps: 10, speedSource: 'gps', engineOn: false});
  });
});

describe('GPS gap fill', () => {
  it('uses adapter distance across a long gap', () => {
    expect(fillGap(400, 30, 650)).toEqual({meters: 650, fromAdapter: true});
  });

  it('keeps GPS for short gaps, missing adapter data, or a shorter adapter step', () => {
    expect(fillGap(40, 2, 45)).toEqual({meters: 40, fromAdapter: false});
    expect(fillGap(400, 30, null)).toEqual({meters: 400, fromAdapter: false});
    expect(fillGap(400, 30, 380)).toEqual({meters: 400, fromAdapter: false});
  });
});

describe('engine-off drive end', () => {
  const STOP_S = 180;
  const base = {engineOnAt: NOW, startedAt: NOW - 600_000, lastMovementAt: NOW - 5_000, idleS: STOP_S};

  it('ends once the engine has been off for the Auto-stop time, back-dated to when it stopped', () => {
    expect(engineEndAt({...base, now: NOW + 179_000})).toBeNull();
    expect(engineEndAt({...base, now: NOW + 180_000})).toBe(NOW);
    // Shorter or longer settings follow along.
    expect(engineEndAt({...base, idleS: 60, now: NOW + 60_000})).toBe(NOW);
  });

  it('never ends while the engine runs, however long the car stands', () => {
    // Running at a standstill: each RPM > 0 reading moves engineOnAt up to now.
    for (let t = 60_000; t <= 1_200_000; t += 60_000) {
      expect(engineEndAt({...base, engineOnAt: NOW + t - 1_000, now: NOW + t})).toBeNull();
    }
  });

  it('does not end at a 150 s red light with start-stop (engine off, ignition on)', () => {
    expect(engineEndAt({...base, now: NOW + 150_000})).toBeNull();
  });

  it('does not end when GPS shows the car still moving (adapter dropped out)', () => {
    expect(engineEndAt({...base, now: NOW + 200_000, lastMovementAt: NOW + 190_000})).toBeNull();
    expect(engineEndAt({...base, now: NOW + 230_000, lastMovementAt: NOW + 190_000})).toBe(NOW);
  });

  it('needs the engine seen running during this drive', () => {
    expect(engineEndAt({...base, now: NOW + 400_000, engineOnAt: null})).toBeNull();
    expect(engineEndAt({...base, now: NOW + 400_000, startedAt: NOW + 1_000})).toBeNull();
  });
});

describe('adapter-led auto rules', () => {
  it('lets the adapter decide once it has seen the engine run in this drive', () => {
    expect(adapterGoverns(NOW, NOW - 1)).toBe(true);
    expect(adapterGoverns(NOW - 10, NOW)).toBe(false);
    expect(adapterGoverns(null, NOW)).toBe(false);
  });

  it('counts the car active while it moves or its engine runs', () => {
    expect(lastActiveAt(NOW - 60_000, NOW - 2_000, true)).toBe(NOW - 2_000);
    expect(lastActiveAt(NOW - 2_000, NOW - 60_000, true)).toBe(NOW - 2_000);
    // Without the adapter in charge, only movement counts.
    expect(lastActiveAt(NOW - 60_000, NOW - 2_000, false)).toBe(NOW - 60_000);
  });
});

describe('last answer', () => {
  it('is the newest reading of any kind', () => {
    expect(lastAnswerAt({rpm: {v: 0, at: 5}, coolant: {v: 80, at: 9}, speed: {v: 0, at: 7}})).toBe(9);
    expect(lastAnswerAt({})).toBeNull();
  });
});

describe('car state', () => {
  it('tells running, engine off and parked apart', () => {
    expect(carState({rpm: {v: 850, at: NOW - 1000}}, NOW)).toBe('running');
    // Engine off at a light: the computer still answers, RPM 0.
    expect(carState({rpm: {v: 0, at: NOW - 8000}, voltage: {v: 12.4, at: NOW - 8000}}, NOW)).toBe('engineOff');
    // Nothing for 20 s: ignition off.
    expect(carState({rpm: {v: 850, at: NOW - 20_000}}, NOW)).toBe('parked');
    expect(carState({}, NOW)).toBe('parked');
  });
});

