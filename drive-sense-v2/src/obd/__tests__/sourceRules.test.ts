import type {Sample} from '../../stores/recordingStore';
import {adapterReading, applyAdapter, engineEndAt, fillGap} from '../sourceRules';

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
  const base = {engineOnAt: NOW, startedAt: NOW - 600_000, lastMovementAt: NOW - 5_000, engineRunningNow: false};

  it('ends 60 s after the engine stops, at the moment it stopped', () => {
    expect(engineEndAt({...base, now: NOW + 59_000})).toBeNull();
    expect(engineEndAt({...base, now: NOW + 60_000})).toBe(NOW);
  });

  it('does not end while the engine runs (auto start-stop restarted it)', () => {
    expect(engineEndAt({...base, now: NOW + 90_000, engineRunningNow: true})).toBeNull();
  });

  it('does not end when GPS shows the car still moving (adapter dropped out)', () => {
    expect(engineEndAt({...base, now: NOW + 90_000, lastMovementAt: NOW + 80_000})).toBeNull();
    expect(engineEndAt({...base, now: NOW + 120_000, lastMovementAt: NOW + 80_000})).toBe(NOW);
  });

  it('needs the engine seen running during this drive', () => {
    expect(engineEndAt({...base, now: NOW + 90_000, engineOnAt: null})).toBeNull();
    expect(engineEndAt({...base, now: NOW + 90_000, startedAt: NOW + 1_000})).toBeNull();
  });
});
