import {AccelEstimator, boostKpa, chooseGear, economyL100, fuelFlowLph, GearEstimator, powerKw, torqueNm} from '../derive';
import {isNoAnswer, parseReply, parseVin} from '../elm327';
import {decodeStatus, keyForCode, PIDS} from '../pids';
import {decodeSupported, SupportTracker} from '../supported';

const decode = (key: keyof typeof PIDS, raw: string) => {
  const def = PIDS[key];
  const bytes = parseReply(raw, def.code, def.bytes);
  return bytes ? def.decode(bytes) : null;
};

describe('PID decoding', () => {
  it('decodes the SAE examples', () => {
    expect(decode('rpm', '41 0C 1A F8\r\r>')).toBe(1726);
    expect(decode('coolant', '41 05 7B')).toBe(83);
    expect(decode('speed', '410D3C')).toBe(60);
    expect(decode('voltage', '41 42 37 0A')).toBeCloseTo(14.09, 2);
    expect(decode('throttle', '41 11 FF')).toBe(100);
    expect(decode('maf', '41 10 03 E8')).toBe(10);
    expect(decode('fuelRate', '41 5E 00 C8')).toBe(10);
  });

  it('skips echo and SEARCHING and takes the first control unit', () => {
    expect(decode('speed', '010D\rSEARCHING...\r41 0D 32\r41 0D 33\r\r>')).toBe(50);
  });

  it('returns null for NO DATA and short replies', () => {
    expect(decode('speed', 'NO DATA\r\r>')).toBeNull();
    expect(isNoAnswer('NO DATA\r\r>')).toBe(true);
    expect(isNoAnswer('41 0D 32')).toBe(false);
    expect(decode('rpm', '41 0C 1A')).toBeNull();
  });

  it('reads the check-engine status byte', () => {
    expect(decodeStatus(0x82)).toEqual({mil: true, codeCount: 2});
    expect(decodeStatus(0x00)).toEqual({mil: false, codeCount: 0});
  });

  it('finds keys by code', () => {
    expect(keyForCode('0c')).toBe('rpm');
    expect(keyForCode('99')).toBeUndefined();
  });

  it('reads a CAN multi-frame VIN', () => {
    const raw = '014\r0: 49 02 01 31 44 34\r1: 47 50 30 30 52 35 35\r2: 42 31 32 33 34 35 36\r\r>';
    expect(parseVin(raw)).toBe('1D4GP00R55B123456');
  });

  it('gives no VIN for NO DATA', () => {
    expect(parseVin('NO DATA')).toBeNull();
  });
});

describe('supported PIDs', () => {
  it('decodes the bitmap', () => {
    expect(decodeSupported('00', [0xbe, 0x1f, 0xa8, 0x13])).toEqual(['01', '03', '04', '05', '06', '07', '0C', '0D', '0E', '0F', '10', '11', '13', '15', '1C', '1F', '20']);
    expect(decodeSupported('20', [0x80, 0, 0, 0])).toEqual(['21']);
  });

  it('drops a PID after three empty replies in a row', () => {
    const t = new SupportTracker();
    t.setSupported(['0C', '5C']);
    expect(t.recordEmpty('5C')).toBe(false);
    t.recordOk('5C');
    expect(t.recordEmpty('5C')).toBe(false);
    expect(t.recordEmpty('5C')).toBe(false);
    expect(t.recordEmpty('5C')).toBe(true);
    expect(t.has('5C')).toBe(false);
    expect(t.has('0c')).toBe(true);
  });
});

describe('derived values', () => {
  it('works out fuel flow from air flow, or uses the fuel rate', () => {
    expect(fuelFlowLph({maf: 10}, 'petrol')).toBeCloseTo(3.287, 2);
    expect(fuelFlowLph({maf: 10, fuelRate: 4}, 'petrol')).toBe(4);
    expect(fuelFlowLph({maf: 10}, 'electric')).toBeNull();
    expect(fuelFlowLph({}, 'diesel')).toBeNull();
  });

  it("turns the car's fuel rate in g/s (PID 9D) into L/h, after 5E and before air flow", () => {
    // 0.28 g/s of petrol (745 g/L) is 1.35 L/h, as Car Scanner showed for the test car.
    expect(fuelFlowLph({fuelRateGs: 0.28}, 'petrol')).toBeCloseTo(1.353, 2);
    expect(fuelFlowLph({fuelRateGs: 0.28}, 'diesel')).toBeCloseTo(1.212, 2);
    expect(fuelFlowLph({fuelRate: 4, fuelRateGs: 0.28, maf: 10}, 'petrol')).toBe(4);
    expect(fuelFlowLph({fuelRateGs: 0.28, maf: 10}, 'petrol')).toBeCloseTo(1.353, 2);
    expect(fuelFlowLph({fuelRateGs: 0.28}, 'electric')).toBeNull();
  });

  it('works out torque from percent × reference, and power from torque × RPM', () => {
    expect(PIDS.torquePct.decode([125 + 9])).toBe(9);
    expect(PIDS.torqueRef.decode([0x00, 0xaf])).toBe(175);
    expect(torqueNm(9, 175)).toBeCloseTo(15.75);
    expect(torqueNm(-5, 175)).toBeCloseTo(-8.75); // engine braking
    expect(torqueNm(9, null)).toBeNull();
    // 100 Nm at 3000 rpm = 31.4 kW.
    expect(powerKw(100, 3000)).toBeCloseTo(31.416, 2);
    expect(powerKw(null, 3000)).toBeNull();
    expect(powerKw(100, null)).toBeNull();
  });

  it('estimates acceleration from adapter speed over about a second, not two readings', () => {
    const a = new AccelEstimator();
    // Steady 50 km/h: 0.
    [0, 250, 500, 750, 1000].forEach((t) => a.add(50, t));
    expect(a.add(50, 1250)).toBeCloseTo(0, 1);
    // +3.6 km/h per second = +1 m/s².
    const b = new AccelEstimator();
    let last: number | null = null;
    for (let t = 0; t <= 1500; t += 250) last = b.add(20 + (t / 1000) * 3.6, t);
    expect(last).toBeCloseTo(1, 1);
    // Braking reads negative.
    const c = new AccelEstimator();
    for (let t = 0; t <= 1500; t += 250) last = c.add(60 - (t / 1000) * 18, t);
    expect(last).toBeCloseTo(-5, 1);
    // Too little history, or a gap over 3 s, says nothing.
    const d = new AccelEstimator();
    expect(d.add(30, 0)).toBeNull();
    d.add(30, 250);
    d.add(31, 500);
    expect(d.add(40, 5000)).toBeNull();
  });

  it("uses the car's gear only when it says something, else the estimate", () => {
    // A real gear from the car wins.
    expect(chooseGear(3, 50, () => 4)).toBe(3);
    // 0 at a standstill is neutral.
    expect(chooseGear(0, 0, () => 2)).toBe(0);
    // 0 while moving: neutral once the car has shown it reports real gears; until then, estimate.
    expect(chooseGear(0, 40, () => 3)).toBe(3);
    expect(chooseGear(0, 40, () => 3, true)).toBe(0);
    // Not reported (−1) or never read: estimate; standing still is neutral.
    expect(chooseGear(-1, 40, () => 2)).toBe(2);
    expect(chooseGear(null, 40, () => null)).toBeNull();
    expect(chooseGear(null, 0, () => 2)).toBe(0);
  });

  it("decodes the car's gear (A4) and odometer (A6)", () => {
    // A bit 0: supported; B high nibble: the gear; C, D: the gear ratio × 1000 (3.500 = 0D AC here).
    expect(PIDS.gearCar.decode([0x01, 0x30, 0x0d, 0xac])).toBe(3);
    expect(PIDS.gearCar.decode([0x01, 0x00, 0x0d, 0xac])).toBe(0);
    expect(PIDS.gearCar.decode([0x00, 0x30, 0x0d, 0xac])).toBe(-1);
    // 221208 tenths = 22120.8 km, as Car Scanner showed.
    expect(PIDS.odometer.decode([0x00, 0x03, 0x60, 0x18])).toBeCloseTo(22120.8);
  });

  it('decodes PID 9D engine fuel rate', () => {
    // 0x000E = 14 → 14 / 50 = 0.28 g/s; bytes C, D are the vehicle rate, ignored.
    expect(PIDS.fuelRateGs.decode([0x00, 0x0e, 0x00, 0x0e])).toBeCloseTo(0.28);
    expect(PIDS.fuelRateGs.code).toBe('9D');
  });

  it('gives no economy at a crawl', () => {
    expect(economyL100(3, 4)).toBeNull();
    expect(economyL100(6, 60)).toBe(10);
  });

  it('shows boost only above outside pressure', () => {
    expect(boostKpa(101, 100)).toBeNull();
    expect(boostKpa(150, 100)).toBe(50);
    expect(boostKpa(null, 100)).toBeNull();
  });

  it('learns gears from rpm/speed clusters, but only names them once it has seen four', () => {
    const g = new GearEstimator();
    // Top gear first (a motorway start): no number yet, it would wrongly be "1st".
    let last: number | null = null;
    for (let i = 0; i < 10; i++) last = g.add(2900, 100);
    expect(last).toBeNull();
    // Then 1st, 2nd and 3rd at ~118, ~68 and ~47 rpm per km/h.
    for (const [rpm, kmh] of [
      [2360, 20],
      [2720, 40],
      [2820, 60],
    ]) {
      for (let i = 0; i < 10; i++) last = g.add(rpm, kmh);
    }
    expect(last).toBe(3);
    g.add(2900, 100);
    g.add(2900, 100);
    expect(g.add(2900, 100)).toBe(4); // top gear now ranks 4th of 4
    expect(g.add(800, 0)).toBeNull();
  });

  it('ignores mid-shift readings that keep recurring', () => {
    const g = new GearEstimator();
    const gears: [number, number][] = [
      [2360, 20],
      [2720, 40],
      [2820, 60],
      [2880, 80],
    ];
    for (let loop = 0; loop < 6; loop++) {
      for (const [rpm, kmh] of gears) {
        for (let i = 0; i < 20; i++) g.add(rpm, kmh);
        g.add(rpm * 0.7, kmh); // a mid-shift reading, at the same spot every loop
      }
    }
    for (let i = 0; i < 3; i++) g.add(2880, 80);
    expect(g.add(2880, 80)).toBe(4);
  });
});
