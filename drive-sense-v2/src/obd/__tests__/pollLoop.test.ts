import {createPollLoop, type PollHandlers, type Transport} from '../pollLoop';
import type {PidKey} from '../pids';

/** An adapter that answers each command from a table (default `NO DATA`), one reply per write. */
function fakeAdapter(answers: Record<string, string | (() => string)>) {
  const sent: string[] = [];
  let listener: ((chunk: string) => void) | null = null;
  const transport: Transport = {
    write: async (text) => {
      const command = text.trim();
      sent.push(command);
      const answer = answers[command];
      const reply = typeof answer === 'function' ? answer() : (answer ?? (command.startsWith('AT') ? 'OK' : 'NO DATA'));
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
};

const handlers = (overrides: Partial<PollHandlers> = {}): PollHandlers & {values: [PidKey, number][]} => {
  const values: [PidKey, number][] = [];
  return {
    values,
    onValue: (k, v) => values.push([k, v]),
    onStatus: jest.fn(),
    onSupported: jest.fn(),
    onVin: jest.fn(),
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

  it('slows down once the engine has been off for 30 s', async () => {
    let t = 0;
    const {transport} = fakeAdapter({...CAR, '010C': '41 0C 00 00'});
    const h = handlers();
    let slept = 0;
    const loop = createPollLoop(transport, h, {
      now: () => (t += 1000),
      sleep: (ms) => (ms === 10_000 ? (++slept >= 2 && loop.stop(), Promise.resolve()) : never()),
    });
    await loop.start();
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
