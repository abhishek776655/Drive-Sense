import {carDrives, putTripObd} from '../../db/obdRepos';
import {migrate} from '../../db/schema';
import type {ObdStats} from '../../obd/series';
import {memoryDb} from '../../testUtils/memoryDb';
import {carDrivesIn, carTotals, type CarDrive} from '../carStats';

const stats = (patch: Partial<ObdStats> = {}): ObdStats => ({
  avgRpm: 2000,
  maxRpm: 3000,
  maxCoolantC: 90,
  fuelUsedL: 1,
  avgL100km: 10,
  idleS: 30,
  coverage: 1,
  ...patch,
});

const drive = (patch: Partial<CarDrive> = {}): CarDrive => ({startMs: Date.UTC(2026, 9, 20, 8), vehicleId: 'v1', durationS: 600, stats: stats(), ...patch});

describe('car totals', () => {
  it('is null without car data', () => {
    expect(carTotals([])).toBeNull();
  });

  it('weighs economy by distance, not by drive', () => {
    // 1 L over 10 km and 4 L over 80 km: 5 L / 90 km, not the 7.5 average of 10 and 5.
    const t = carTotals([drive(), drive({stats: stats({fuelUsedL: 4, avgL100km: 5})})]);
    expect(t?.fuelL).toBe(5);
    expect(t?.avgL100km).toBeCloseTo(5.6, 1);
    expect(t?.bestL100km).toBe(5);
  });

  it('weighs RPM by time and keeps the peaks', () => {
    const t = carTotals([drive({durationS: 300, stats: stats({avgRpm: 1000})}), drive({durationS: 900, stats: stats({avgRpm: 3000, maxRpm: 5200, maxCoolantC: 104})})]);
    expect(t?.avgRpm).toBe(2500);
    expect(t?.maxRpm).toBe(5200);
    expect(t?.maxCoolantC).toBe(104);
    expect(t?.idleS).toBe(60);
    expect(t?.drives).toBe(2);
  });

  it('adds up idle fuel from the drives that measured it', () => {
    const t = carTotals([drive({stats: stats({idleFuelL: 0.05})}), drive({stats: stats({idleFuelL: 0.1})}), drive()]);
    expect(t?.idleFuelL).toBe(0.15);
    expect(carTotals([drive()])?.idleFuelL).toBeNull();
  });

  it('leaves out fuel for cars that never reported it', () => {
    const t = carTotals([drive({stats: stats({fuelUsedL: null, avgL100km: null})})]);
    expect(t?.fuelL).toBeNull();
    expect(t?.avgL100km).toBeNull();
  });

  it('filters by period and vehicle like the overview', () => {
    const now = new Date(2026, 9, 25, 12);
    const thisWeek = drive({startMs: new Date(2026, 9, 21, 9).getTime()});
    const lastMonth = drive({startMs: new Date(2026, 8, 3, 9).getTime()});
    const otherCar = drive({startMs: new Date(2026, 9, 22, 9).getTime(), vehicleId: 'v2'});
    const all = [thisWeek, lastMonth, otherCar];
    expect(carDrivesIn(all, {period: 'week', now})).toEqual([thisWeek, otherCar]);
    expect(carDrivesIn(all, {period: 'month', vehicleId: 'v1', now})).toEqual([thisWeek]);
    expect(carDrivesIn(all, {period: 'all', now})).toHaveLength(3);
    expect(carDrivesIn(all, {period: 'custom', range: {start: '2026-09-01', end: '2026-09-30'}, now})).toEqual([lastMonth]);
  });
});

describe('car drives from the database', () => {
  it('joins OBD data to its trip by start time', () => {
    const db = memoryDb();
    migrate(db);
    const insert = (id: string, vehicle: string, start: string, duration: number) =>
      db.run(`INSERT INTO trips (id, vehicle_id, start_time, distance_meters, duration_seconds, search_text, json) VALUES (?, ?, ?, 0, ?, '', '{}')`, [id, vehicle, start, duration]);
    insert('a', 'v1', '2026-10-25T07:30:01.375Z', 120);
    insert('b', 'v2', '2026-10-25T09:00:00.000Z', 300);
    // The phone's start time is the GPS fix, a moment off the stored one; a third row has no trip.
    putTripObd(db, Date.parse('2026-10-25T07:30:01.375Z') + 0.4, {stats: stats(), series: {t: [], rpm: [], speed: [], coolant: [], fuelFlow: [], throttle: [], load: []}});
    putTripObd(db, Date.parse('2026-10-25T09:00:00.000Z') - 1500, {stats: stats({maxRpm: 4000}), series: {t: [], rpm: [], speed: [], coolant: [], fuelFlow: [], throttle: [], load: []}});
    putTripObd(db, Date.parse('2026-10-24T09:00:00.000Z'), {stats: stats(), series: {t: [], rpm: [], speed: [], coolant: [], fuelFlow: [], throttle: [], load: []}});
    const rows = carDrives(db);
    expect(rows.map((r) => [r.vehicleId, r.durationS])).toEqual([
      ['v1', 120],
      ['v2', 300],
    ]);
    expect(rows[1].stats.maxRpm).toBe(4000);
  });
});
