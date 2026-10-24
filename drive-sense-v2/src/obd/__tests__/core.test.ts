import {boostKpa, economyL100, fuelFlowLph, GearEstimator} from '../derive';
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

  it('gives no economy at a crawl', () => {
    expect(economyL100(3, 4)).toBeNull();
    expect(economyL100(6, 60)).toBe(10);
  });

  it('shows boost only above outside pressure', () => {
    expect(boostKpa(101, 100)).toBeNull();
    expect(boostKpa(150, 100)).toBe(50);
    expect(boostKpa(null, 100)).toBeNull();
  });

  it('learns gears from rpm/speed clusters', () => {
    const g = new GearEstimator();
    // 3rd-ish gear at ~50 rpm per km/h, then 4th at ~38.
    let last: number | null = null;
    for (let i = 0; i < 25; i++) last = g.add(2500, 50);
    for (let i = 0; i < 25; i++) last = g.add(2280, 60);
    expect(last).toBe(2);
    expect(g.add(2500, 50)).toBeNull(); // the switch back has to hold first
    g.add(2500, 50);
    expect(g.add(2500, 50)).toBe(1);
    expect(g.add(800, 0)).toBeNull();
  });
});
