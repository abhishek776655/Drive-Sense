import {createPollLoop, type PollHandlers, type Transport} from '../pollLoop';
import type {PidKey} from '../pids';

/** An adapter that answers each command from a table (default `NO DATA`), one reply per write. */
function fakeAdapter(answers: Record<string, string | (() => string | null)>) {
  const sent: string[] = [];
  let listener: ((chunk: string) => void) | null = null;
  const transport: Transport = {
    write: async (text) => {
      const command = text.trim();
      sent.push(command);
      const answer = answers[command];
      const reply = typeof answer === 'function' ? answer() : (answer ?? (command.startsWith('AT') ? 'OK' : 'NO DATA'));
      if (reply === null) {
        return; // the adapter says nothing (still searching for the car's protocol)
      }
      // Split in two chunks, like BLE notifications do.
      void Promise.resolve().then(() => {
        listener?.(reply.slice(0, 3));
        listener?.(`${reply.slice(3)}\r\r>`);
      });
    },
    onData: (cb) => {
      listener = cb;
      return () => {
        listener = null;
      };
    },
  };
  return {transport, sent};
}

const CAR = {
  // Supported: 01, 04, 05, 0C, 0D, 10, 11, 1F, 20 (next bitmap), then 2F and 33 in the 20 range.
  '0100': '41 00 98 19 80 03',
  '0120': '41 20 00 02 20 00',
  '0101': '41 01 82 07 E5 00',
  '0104': '41 04 80',
  '0105': '41 05 7B',
  '010C': '41 0C 1A F8',
  '010D': '41 0D 3C',
  '0110': '41 10 03 E8',
  '0111': '41 11 33',
  '011F': '41 1F 00 3C',
  '012F': '41 2F 80',
  '0133': '41 33 64',
  '0902': '014\r0: 49 02 01 31 44 34\r1: 47 50 30 30 52 35 35\r2: 42 31 32 33 34 35 36',
  '03': '43 02 01 33 04 20',
};

const handlers = (overrides: Partial<PollHandlers> = {}): PollHandlers & {values: [PidKey, number][]} => {
  const values: [PidKey, number][] = [];
  return {
    values,
    onValue: (k, v) => values.push([k, v]),
    onStatus: jest.fn(),
    onSupported: jest.fn(),
    onVin: jest.fn(),
    onCodes: jest.fn(),
    onEngine: jest.fn(),
    onError: jest.fn(),
    ...overrides,
  };
};

const never = () => new Promise<void>(() => undefined);

describe('poll loop', () => {
  it('initialises, learns the car, then polls only what it supports', async () => {
    const {transport, sent} = fakeAdapter(CAR);
    const h = handlers();
    const loop = createPollLoop(transport, {...h, onValue: (k, v, at) => (h.onValue(k, v, at), h.values.length >= 30 && loop.stop())}, {sleep: never});
    await loop.start();

    expect(sent.slice(0, 6)).toEqual(['ATZ', 'ATE0', 'ATL0', 'ATS0', 'ATH0', 'ATSP0']);
    expect(sent.slice(6, 8)).toEqual(['0100', '0120']);
    expect(h.onSupported).toHaveBeenCalledWith(expect.arrayContaining(['speed', 'rpm', 'coolant', 'maf', 'fuelLevel', 'baro', 'status']));
    expect(h.onStatus).toHaveBeenCalledWith({mil: true, codeCount: 2});
    expect(h.onCodes).toHaveBeenCalledWith(['P0133', 'P0420']);
    expect(h.onVin).toHaveBeenCalledWith('1D4GP00R55B123456');
    // Never asked: oil temperature (5C) and fuel rate (5E) are not in the bitmaps.
    expect(sent).not.toContain('015C');
    expect(sent).not.toContain('015E');
    expect(h.values).toContainEqual(['rpm', 1726]);
    expect(h.values).toContainEqual(['coolant', 83]);
    // Air flow every 2nd cycle, so fewer reads than speed.
    const count = (k: PidKey) => h.values.filter(([key]) => key === k).length;
    expect(count('maf')).toBeLessThan(count('speed'));
    expect(count('maf')).toBeGreaterThan(0);
  });

  it('gives the first request time for the adapter to find the car\'s protocol', async () => {
    const {transport, sent} = fakeAdapter(CAR);
    const waits: Record<string, number> = {};
    const loop = createPollLoop(transport, handlers({onValue: () => loop.stop()}), {
      sleep: (ms) => {
        waits[sent[sent.length - 1]] ??= ms;
        return never();
      },
    });
    await loop.start();
    // ATSP0 makes the first 0100 search protocols, which takes seconds; later requests are quick.
    expect(waits['0100']).toBeGreaterThanOrEqual(10_000);
    expect(waits['0120']).toBeLessThan(5_000);
  });

  it('reports every PID the car lists, including ones the app does not read', async () => {
    const {transport} = fakeAdapter(CAR);
    const onSupportedCodes = jest.fn();
    const loop = createPollLoop(transport, handlers({onSupportedCodes, onValue: () => loop.stop()}), {sleep: never});
    await loop.start();
    // 0100 lists 04 05 0C 0D 10 11 1F (+20, the next bitmap); 0120 lists 2F and 33.
    expect(onSupportedCodes).toHaveBeenCalledWith(expect.arrayContaining(['04', '05', '0C', '0D', '10', '11', '1F', '2F', '33']));
  });

  it('follows the bitmaps past 0x80 and reads fuel rate from 9D when the car has no 5E', async () => {
    // 0160 lists 0x80 (its last bit); 0180 lists 9D (byte 3, bit 4) and A0; 01A0 lists nothing more.
    const car = {
      ...CAR,
      '0120': '41 20 00 02 20 01',
      '0140': '41 40 00 00 00 01',
      '0160': '41 60 00 00 00 01',
      '0180': '41 80 00 00 00 09',
      '01A0': '41 A0 00 00 00 00',
      '019D': '41 9D 00 0E 00 0E',
    };
    const {transport, sent} = fakeAdapter(car);
    const h = handlers();
    const loop = createPollLoop(transport, {...h, onValue: (k, v, at) => (h.onValue(k, v, at), h.values.length >= 30 && loop.stop())}, {sleep: never});
    await loop.start();
    expect(sent).toEqual(expect.arrayContaining(['0180', '01A0']));
    expect(h.values).toContainEqual(['fuelRateGs', 0.28]);
    expect(sent).not.toContain('015E');
  });

  it('reads reference torque once and actual torque every second cycle, when listed', async () => {
    // 0160 lists 62 and 63 (byte 0, bits 1 and 2) and nothing beyond.
    const car = {...CAR, '0120': '41 20 00 02 20 01', '0140': '41 40 00 00 00 01', '0160': '41 60 60 00 00 00', '0162': '41 62 86', '0163': '41 63 00 AF'};
    const {transport, sent} = fakeAdapter(car);
    const h = handlers();
    const loop = createPollLoop(transport, {...h, onValue: (k, v, at) => (h.onValue(k, v, at), h.values.length >= 40 && loop.stop())}, {sleep: never});
    await loop.start();
    expect(sent.filter((c) => c === '0163')).toHaveLength(1);
    expect(h.values).toContainEqual(['torqueRef', 175]);
    expect(h.values).toContainEqual(['torquePct', 9]);
    const speeds = sent.filter((c) => c === '010D').length;
    expect(sent.filter((c) => c === '0162').length).toBeLessThan(speeds);
  });

  it('reads the odometer once on connect', async () => {
    // 01A0 lists A6 (byte 0, bit 5).
    const car = {
      ...CAR,
      '0120': '41 20 00 02 20 01',
      '0140': '41 40 00 00 00 01',
      '0160': '41 60 00 00 00 01',
      '0180': '41 80 00 00 00 01',
      '01A0': '41 A0 04 00 00 00',
      '01A6': '41 A6 00 03 60 18',
    };
    const {transport, sent} = fakeAdapter(car);
    const h = handlers();
    const loop = createPollLoop(transport, {...h, onValue: (k, v, at) => (h.onValue(k, v, at), h.values.length >= 30 && loop.stop())}, {sleep: never});
    await loop.start();
    expect(sent.filter((c) => c === '01A6')).toHaveLength(1);
    expect(h.values.find(([k]) => k === 'odometer')?.[1]).toBeCloseTo(22120.8);
  });

  it('asks 0100 again when the first try gets no answer', async () => {
    let tries = 0;
    const {transport, sent} = fakeAdapter({...CAR, '0100': () => (++tries === 1 ? null : '41 00 98 19 80 03')});
    const h = handlers();
    // A reply timeout fires only for the silent first try.
    const loop = createPollLoop(transport, {...h, onValue: () => loop.stop()}, {sleep: () => (tries === 1 ? Promise.resolve() : never())});
    await loop.start();
    expect(sent.filter((c) => c === '0100')).toHaveLength(2);
    expect(h.onSupported).toHaveBeenCalledWith(expect.arrayContaining(['speed', 'rpm']));
  });

  it('stops asking for a PID after three empty replies', async () => {
    const {transport, sent} = fakeAdapter({...CAR, '0105': 'NO DATA'});
    const h = handlers();
    let reads = 0;
    const loop = createPollLoop(transport, {...h, onValue: () => ++reads >= 60 && loop.stop()}, {sleep: never});
    await loop.start();
    expect(sent.filter((c) => c === '0105')).toHaveLength(3);
  });

  it('reports a car with no Mode 01 and stops', async () => {
    const {transport} = fakeAdapter({});
    const h = handlers();
    await createPollLoop(transport, h, {sleep: never}).start();
    expect(h.onSupported).toHaveBeenCalledWith([]);
    expect(h.onEngine).not.toHaveBeenCalled();
  });

  it('re-initialises after three garbage replies', async () => {
    // The adapter garbles its first three fast replies after VIN, as a desynced clone does.
    let fastCalls = 0;
    const garbled = (good: string) => () => (++fastCalls <= 3 ? 'ZZZ' : good);
    const {transport, sent} = fakeAdapter({...CAR, '010D': garbled('41 0D 3C'), '010C': garbled('41 0C 1A F8'), '0111': garbled('41 11 33')});
    const h = handlers();
    const loop = createPollLoop(transport, {...h, onValue: (k) => k === 'speed' && loop.stop()}, {sleep: never});
    await loop.start();
    expect(sent.filter((c) => c === 'ATZ').length).toBeGreaterThanOrEqual(2);
  });

  it('with the engine stopped but the ignition on, reads RPM and voltage several times a second', async () => {
    let t = 0;
    const {transport, sent} = fakeAdapter({...CAR, '010C': '41 0C 00 00', ATRV: '12.5V'});
    const h = handlers();
    const pauses: number[] = [];
    const loop = createPollLoop(transport, h, {
      now: () => (t += 1000),
      sleep: (ms) => {
        if (ms !== 250 && ms !== 10_000) {
          return never(); // reply timeouts: the fake adapter always answers
        }
        pauses.push(ms);
        if (pauses.length >= 40) {
          loop.stop();
        }
        return Promise.resolve();
      },
    });
    await loop.start();
    expect(pauses.every((ms) => ms === 250)).toBe(true);
    expect(h.values).toContainEqual(['voltage', 12.5]);
    expect(sent.filter((c) => c === 'ATRV').length).toBeGreaterThan(30);
    expect(h.onEngine).toHaveBeenLastCalledWith(false);
  });

  it('slows to a 10 s check once the car stops answering (ignition off)', async () => {
    let t = 0;
    let awake = true;
    const answers: Record<string, string | (() => string)> = {};
    for (const [cmd, reply] of Object.entries(CAR)) {
      answers[cmd] = cmd.startsWith('01') && !['0100', '0120'].includes(cmd) ? () => (awake ? reply : 'NO DATA') : reply;
    }
    const {transport} = fakeAdapter(answers);
    const h = handlers();
    let slow = 0;
    let reads = 0;
    const loop = createPollLoop(transport, {...h, onValue: (k) => k === 'rpm' && ++reads === 2 && (awake = false)}, {
      now: () => (t += 5000),
      sleep: (ms) => (ms === 10_000 ? (++slow >= 2 && loop.stop(), Promise.resolve()) : never()),
    });
    await loop.start();
    expect(slow).toBe(2);
    expect(h.onEngine).toHaveBeenLastCalledWith(false);
  });

  it('keeps every PID through an ignition-off spell (all replies empty)', async () => {
    let ignition = true;
    const answers: Record<string, string | (() => string)> = {};
    for (const [cmd, reply] of Object.entries(CAR)) {
      answers[cmd] = cmd.startsWith('01') && !['0100', '0120'].includes(cmd) ? () => (ignition ? reply : 'NO DATA') : reply;
    }
    const {transport, sent} = fakeAdapter(answers);
    let rpmReads = 0;
    let slowPolls = 0;
    let t = 0;
    const loop = createPollLoop(
      transport,
      handlers({
        onValue: (k) => {
          if (k !== 'rpm') {
            return;
          }
          rpmReads += 1;
          if (rpmReads === 3) {
            ignition = false; // key out
          } else if (rpmReads > 3) {
            loop.stop(); // read again once the ignition came back on
          }
        },
      }),
      {
        now: () => (t += 5000), // each request moves the clock 5 s, so the 30 s engine-off wait passes
        sleep: (ms) => {
          if (ms !== 10_000) {
            return never();
          }
          if (++slowPolls === 3) {
            ignition = true; // key back in after a few slow polls
          }
          return Promise.resolve();
        },
      },
    );
    await loop.start();
    expect(slowPolls).toBeGreaterThanOrEqual(3);
    expect(rpmReads).toBe(4);
    // RPM was still being asked for after a long run of empty replies.
    const lastRpm = sent.lastIndexOf('010C');
    expect(lastRpm).toBeGreaterThan(sent.indexOf('010C') + 20);
  });
});
