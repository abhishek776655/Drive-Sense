import {parseReply, parseVin} from '../elm327';
import {PIDS, type PidKey} from '../pids';
import {createPollLoop} from '../pollLoop';
import {CYCLE_S, createSimAdapter, simCar, simReply, SIM_VIN} from '../simAdapter';
import {decodeSupported} from '../supported';

const read = (key: PidKey, elapsedS: number) => {
  const def = PIDS[key];
  const bytes = parseReply(simReply(`01${def.code}`, simCar(elapsedS)), def.code, def.bytes);
  return bytes ? def.decode(bytes) : null;
};

describe('simulated car', () => {
  it('idles, pulls away, cruises and stops within a cycle', () => {
    expect(read('speed', 2)).toBe(0);
    expect(read('rpm', 2)).toBeGreaterThan(700);
    expect(read('speed', 35)).toBeGreaterThan(70);
    expect(read('speed', 57)).toBe(0);
    expect(read('speed', CYCLE_S + 35)).toBe(read('speed', 35));
  });

  it('keeps rpm in a sane band and warms the engine up', () => {
    for (let t = 0; t < CYCLE_S; t++) {
      const rpm = read('rpm', t) ?? 0;
      expect(rpm).toBeGreaterThan(700);
      expect(rpm).toBeLessThan(3300);
    }
    expect(read('coolant', 0)).toBeLessThan(30);
    expect(read('coolant', 300)).toBeGreaterThan(85);
  });

  it('round-trips through the real decoders', () => {
    expect(read('voltage', 10)).toBeCloseTo(14.2, 1);
    expect(read('baro', 10)).toBe(100);
    expect(read('fuelLevel', 0)).toBeCloseTo(62, 0);
    expect(parseVin(simReply('0902', simCar(0)))).toBe(SIM_VIN);
  });

  it('advertises exactly the PIDs it answers', () => {
    const bitmap = (base: string) => parseReply(simReply(`01${base}`, simCar(0)), base, 4) ?? [];
    const codes = [...decodeSupported('00', bitmap('00')), ...decodeSupported('20', bitmap('20')), ...decodeSupported('40', bitmap('40'))];
    expect(codes).toEqual(['01', '04', '05', '0B', '0C', '0D', '0F', '10', '11', '1F', '20', '2F', '33', '40', '42', '46']);
    expect(simReply('015C', simCar(0))).toBe('NO DATA');
  });

  it('drives the real poll loop end to end', async () => {
    const values: PidKey[] = [];
    let vin = '';
    const loop = createPollLoop(createSimAdapter(), {
      onValue: (k) => values.push(k) >= 25 && loop.stop(),
      onStatus: jest.fn(),
      onSupported: jest.fn(),
      onVin: (v) => (vin = v),
      onEngine: jest.fn(),
      onError: (e) => {
        throw e;
      },
    });
    await loop.start();
    expect(vin).toBe(SIM_VIN);
    expect(values).toEqual(expect.arrayContaining(['speed', 'rpm', 'throttle', 'load', 'maf']));
    expect(values).not.toContain('oilTemp');
  });
});
