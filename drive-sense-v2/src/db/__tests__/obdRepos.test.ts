import {downsample, summarize, type ObdRow, type ObdSampleRow} from '../../obd/series';
import {memoryDb} from '../../testUtils/memoryDb';
import {
  appendObdSamples,
  clearObdSamples,
  deleteAdapter,
  deleteTripObd,
  getAdapter,
  listAdapters,
  obdSamples,
  putAdapter,
  putTripObd,
  tripObd,
  type ObdAdapter,
} from '../obdRepos';
import {migrate, MIGRATIONS, schemaVersion} from '../schema';

const T0 = Date.UTC(2026, 9, 25, 8, 0, 0);

const rows = (n: number, at = (i: number) => T0 + i * 1000, row = (i: number): ObdRow => ({rpm: 2000 + i, speed: 50, coolant: 90, fuelFlow: 6})): ObdSampleRow[] =>
  Array.from({length: n}, (_, i) => ({ts: at(i), row: row(i)}));

const adapter = (patch: Partial<ObdAdapter> = {}): ObdAdapter => ({
  vehicleId: 'v1',
  deviceId: 'dev-1',
  deviceName: 'IOS-Vlink',
  vin: null,
  supported: ['rpm', 'speed'],
  lastSeen: '2026-10-25T08:00:00.000Z',
  lastState: null,
  ...patch,
});

describe('OBD storage', () => {
  it('migrates to v6', () => {
    const db = memoryDb();
    migrate(db);
    expect(schemaVersion(db)).toBe(MIGRATIONS.length);
    expect(db.all('SELECT name FROM sqlite_master WHERE name IN (?, ?, ?)', ['drive_obd_samples', 'trip_obd', 'obd_adapters'])).toHaveLength(3);
  });

  it('keeps, reads and clears the drive in progress', () => {
    const db = memoryDb();
    migrate(db);
    appendObdSamples(db, T0, rows(3));
    appendObdSamples(db, T0 + 99, rows(1));
    expect(obdSamples(db, T0).map((r) => r.row.rpm)).toEqual([2000, 2001, 2002]);
    clearObdSamples(db, T0);
    expect(obdSamples(db, T0)).toEqual([]);
    expect(obdSamples(db, T0 + 99)).toHaveLength(1);
  });

  it('finds a trip by start time within two seconds', () => {
    const db = memoryDb();
    migrate(db);
    const r = rows(10);
    putTripObd(db, T0, {stats: summarize(r, 10), series: downsample(r, T0)});
    expect(tripObd(db, T0 + 1500)?.stats.maxRpm).toBe(2009);
    expect(tripObd(db, T0 + 5000)).toBeNull();
    deleteTripObd(db, T0 + 1000);
    expect(tripObd(db, T0)).toBeNull();
  });

  it('takes a start time with fractional milliseconds (iOS GPS timestamps)', () => {
    const db = memoryDb();
    migrate(db);
    const r = rows(3);
    putTripObd(db, T0 + 0.375, {stats: summarize(r, 3), series: downsample(r, T0)});
    expect(tripObd(db, T0 + 0.375)?.stats.maxRpm).toBe(2002);
  });

  it('pairs one adapter to one vehicle', () => {
    const db = memoryDb();
    migrate(db);
    putAdapter(db, adapter());
    putAdapter(db, adapter({vehicleId: 'v2', vin: 'VIN'}));
    expect(getAdapter(db, 'v1')).toBeNull();
    expect(getAdapter(db, 'v2')?.vin).toBe('VIN');
    expect(listAdapters(db)).toHaveLength(1);
    deleteAdapter(db, 'v2');
    expect(listAdapters(db)).toEqual([]);
  });
});

describe('OBD summary', () => {
  it('works out fuel, economy, idle and coverage', () => {
    // 600 s at 60 km/h and 6 L/h, then 60 s idling.
    const moving = rows(600, undefined, () => ({rpm: 2000, speed: 60, fuelFlow: 6, coolant: 90}));
    const idling = rows(60, (i) => T0 + (600 + i) * 1000, () => ({rpm: 800, speed: 0, fuelFlow: 0.8, coolant: 96}));
    const s = summarize([...moving, ...idling], 700);
    expect(s.fuelUsedL).toBeCloseTo(1.01, 2);
    expect(s.avgL100km).toBeCloseTo(10.1, 1);
    expect(s.idleS).toBe(60);
    expect(s.maxCoolantC).toBe(96);
    expect(s.maxRpm).toBe(2000);
    expect(s.coverage).toBeCloseTo(0.943, 3);
  });

  it('leaves out what was never read', () => {
    const s = summarize(rows(5, undefined, () => ({speed: 10})), 5);
    expect(s).toMatchObject({avgRpm: null, maxRpm: null, fuelUsedL: null, avgL100km: null, maxCoolantC: null});
  });
});

describe('OBD series', () => {
  it('caps the points and keeps peaks', () => {
    const r = rows(3600, undefined, (i) => ({rpm: i === 1234 ? 6500 : 2000, speed: 50}));
    const s = downsample(r, T0);
    expect(s.t.length).toBeLessThanOrEqual(600);
    expect(Math.max(...(s.rpm as number[]))).toBe(6500);
    expect(s.speed.every((v) => v === 50)).toBe(true);
  });

  it('marks gaps with null', () => {
    const r = [...rows(10), ...rows(10, (i) => T0 + (100 + i) * 1000)];
    const s = downsample(r, T0);
    expect(s.t[0]).toBe(0);
    expect(s.rpm.filter((v) => v == null).length).toBeGreaterThan(0);
    expect(s.coolant[s.coolant.length - 1]).toBe(90);
  });

  it('is empty without rows', () => {
    expect(downsample([], T0).t).toEqual([]);
  });
});
