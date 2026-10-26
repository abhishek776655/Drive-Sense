import {parseVoltage} from './battery';
import {parseDtcReply} from './dtc';
import {ELM_INIT, isNoAnswer, parseReply, parseVin, pidRequest, PROMPT} from './elm327';
import {decodeStatus, keyForCode, PIDS, type PidKey} from './pids';
import {decodeSupported, SupportTracker} from './supported';

/** A text pipe to the adapter. BLE is one; tests use a scripted fake. */
export interface Transport {
  write: (text: string) => Promise<void>;
  /** Raw chunks as they arrive; a reply may come in several. Returns an unsubscribe. */
  onData: (cb: (chunk: string) => void) => () => void;
}

export interface PollHandlers {
  onValue: (key: PidKey, value: number, at: number) => void;
  onStatus: (status: {mil: boolean; codeCount: number}) => void;
  /** What the car answers; empty means no Mode 01 at all (EV, some hybrids). */
  onSupported: (keys: PidKey[]) => void;
  /** Every Mode 01 PID the car lists, including ones the app does not read (for diagnosis). */
  onSupportedCodes?: (codes: string[]) => void;
  onVin: (vin: string) => void;
  /** Stored trouble codes, read whenever the status says there are any (empty when cleared). */
  onCodes?: (codes: string[]) => void;
  onEngine: (running: boolean) => void;
  onError: (error: Error) => void;
}

export interface PollOptions {
  now?: () => number;
  /** Waits used only for timeouts and the slow engine-off poll. */
  sleep?: (ms: number) => Promise<void>;
  replyTimeoutMs?: number;
}

/** Status (check-engine light) is re-read every this many cycles (~60 s at 4 cycles/s). */
const STATUS_EVERY = 240;
/** Unparseable replies in a row before the adapter is re-initialised. */
const GARBAGE_LIMIT = 3;
/** No engine for this long → slow poll. */
const ENGINE_OFF_MS = 30_000;
const ENGINE_OFF_POLL_MS = 10_000;
/** Engine off but the ignition on: RPM and battery voltage this often, to catch the start dip. */
const ENGINE_STOPPED_POLL_MS = 250;
/** Keep reading voltage every round this long after the engine catches (the dip's tail). */
const AFTER_START_MS = 3000;
const SUPPORTED_BASES = ['00', '20', '40', '60', '80', 'A0'];
/** How long the first 0100 may take while the adapter finds the car's protocol, and how often it is tried. */
const PROTOCOL_SEARCH_MS = 12_000;
const FIRST_REQUEST_ATTEMPTS = 3;

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Asks the adapter for PIDs in a loop. Event-driven: each reply sends the next request, so it keeps
 * going in the background on iOS, where JS timers pause but Bluetooth callbacks still run.
 */
export function createPollLoop(transport: Transport, handlers: PollHandlers, opts: PollOptions = {}) {
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? defaultSleep;
  const timeoutMs = opts.replyTimeoutMs ?? 2500;
  const tracker = new SupportTracker();
  let running = false;
  let buffer = '';
  let waiting: ((reply: string) => void) | null = null;
  let unsubscribe: (() => void) | null = null;

  const ask = (command: string, wait = timeoutMs): Promise<string> =>
    new Promise<string>((resolve) => {
      buffer = '';
      let done = false;
      const finish = (reply: string) => {
        if (!done) {
          done = true;
          waiting = null;
          resolve(reply);
        }
      };
      waiting = finish;
      transport.write(`${command}\r`).catch((e: unknown) => {
        handlers.onError(e instanceof Error ? e : new Error(String(e)));
        finish('');
      });
      void sleep(wait).then(() => finish(''));
    });

  const onChunk = (chunk: string) => {
    buffer += chunk;
    const end = buffer.indexOf(PROMPT);
    if (end >= 0 && waiting) {
      const reply = buffer.slice(0, end);
      buffer = buffer.slice(end + 1);
      waiting(reply);
    }
  };

  const init = async () => {
    for (const command of ELM_INIT) {
      await ask(command, command === 'ATZ' ? 4000 : timeoutMs);
    }
  };

  /**
   * The first request after `ATSP0` makes the adapter search for the car's protocol, which can take
   * several seconds (longer on pre-CAN cars) and sometimes fails once while the car wakes up. Give it
   * time and another go before concluding the car has no Mode 01.
   */
  const askFirstSupported = async (): Promise<number[] | null> => {
    for (let attempt = 0; attempt < FIRST_REQUEST_ATTEMPTS && running; attempt++) {
      const bytes = parseReply(await ask(pidRequest(SUPPORTED_BASES[0]), PROTOCOL_SEARCH_MS), SUPPORTED_BASES[0], 4);
      if (bytes) {
        return bytes;
      }
    }
    return null;
  };

  const readSupported = async (): Promise<PidKey[]> => {
    const codes: string[] = [];
    for (const base of SUPPORTED_BASES) {
      const bytes = base === SUPPORTED_BASES[0] ? await askFirstSupported() : parseReply(await ask(pidRequest(base)), base, 4);
      if (!bytes) {
        break;
      }
      const listed = decodeSupported(base, bytes);
      codes.push(...listed);
      // The last bit of each bitmap says whether the next bitmap exists.
      const next = (parseInt(base, 16) + 0x20).toString(16).toUpperCase().padStart(2, '0');
      if (!listed.includes(next)) {
        break;
      }
    }
    tracker.setSupported(codes);
    handlers.onSupportedCodes?.(codes);
    return codes.map(keyForCode).filter((k): k is PidKey => k != null);
  };

  /** Reads one PID; returns the value, or null (its empty reply held until the round settles). */
  let garbage = 0;
  let empties: string[] = [];
  /**
   * An empty reply only counts against a PID when the car's computer answered something else in the
   * same round. With the ignition off every PID comes back empty, and dropping them all would leave
   * nothing to ask once the car starts again.
   */
  const settle = (answered: boolean) => {
    if (answered) {
      empties.forEach((code) => tracker.recordEmpty(code));
    }
    empties = [];
  };
  const read = async (key: PidKey): Promise<number | null> => {
    const def = PIDS[key];
    const raw = await ask(pidRequest(def.code));
    const bytes = parseReply(raw, def.code, def.bytes);
    if (bytes) {
      garbage = 0;
      tracker.recordOk(def.code);
      const value = def.decode(bytes);
      if (key === 'status') {
        const status = decodeStatus(value);
        handlers.onStatus(status);
        handlers.onCodes?.(status.codeCount > 0 ? parseDtcReply(await ask('03')) : []);
      } else {
        handlers.onValue(key, value, now());
      }
      return value;
    }
    if (isNoAnswer(raw)) {
      garbage = 0;
      empties.push(def.code);
    } else {
      garbage += 1;
    }
    return null;
  };

  const has = (key: PidKey) => tracker.has(PIDS[key].code);

  const run = async () => {
    await init();
    const keys = await readSupported();
    handlers.onSupported(keys);
    if (keys.length === 0) {
      running = false;
      return;
    }
    let answeredOnce = false;
    for (const key of ['baro', 'runTime', 'distSinceClear', 'torqueRef', 'status'] as PidKey[]) {
      if (running && has(key)) {
        answeredOnce = (await read(key)) != null || answeredOnce;
      }
    }
    settle(answeredOnce);
    const vin = running ? parseVin(await ask('0902')) : null;
    if (vin) {
      handlers.onVin(vin);
    }

    /** The adapter's own supply voltage (`ATRV`): quick, and answered even with the engine off. */
    const readVoltage = async () => {
      const v = parseVoltage(await ask('ATRV'));
      if (v != null) {
        handlers.onValue('voltage', v, now());
      }
    };

    let cycle = 0;
    let slowIndex = 0;
    let lastEngineAt = now();
    let engineOn = true;
    let lastRpm: number | null = null;
    let lastAnswered = true;
    let caughtAt: number | null = null;
    handlers.onEngine(true);
    while (running) {
      cycle += 1;
      const plan: PidKey[] = (['speed', 'rpm', 'throttle', 'load'] as PidKey[]).filter(has);
      if (cycle % 2 === 0) {
        // The car's own fuel figure first (L/h, then g/s), air flow last.
        const flow = (['fuelRate', 'fuelRateGs', 'maf'] as PidKey[]).find(has);
        if (flow) {
          plan.push(flow);
        }
        if (has('torquePct')) {
          plan.push('torquePct');
        }
      }
      const slow = (['coolant', 'intakeTemp', 'map', 'fuelLevel', 'voltage', 'ambient', 'oilTemp'] as PidKey[]).filter(has);
      if (slow.length > 0) {
        plan.push(slow[slowIndex++ % slow.length]);
      }
      if (cycle % STATUS_EVERY === 0 && has('status')) {
        plan.push('status');
      }

      let rpm: number | null = null;
      let answered = false;
      // Three paces: the full plan while the engine runs; RPM and voltage several times a second with
      // the engine stopped but the ignition on (to catch the start dip); a slow check while silent.
      const stopped = lastRpm === 0 && lastAnswered;
      const ask = stopped ? (['rpm'] as PidKey[]).filter(has) : engineOn ? plan : (['rpm', 'status'] as PidKey[]).filter(has);
      if (stopped || (caughtAt != null && now() - caughtAt < AFTER_START_MS)) {
        await readVoltage();
      }
      if (ask.length === 0) {
        // Nothing left to ask: wait rather than spin (a loop with no replies to await never yields).
        await sleep(ENGINE_OFF_POLL_MS);
        continue;
      }
      for (const key of ask) {
        if (!running) {
          return;
        }
        const value = await read(key);
        answered = answered || value != null;
        if (key === 'rpm') {
          rpm = value;
        }
        if (garbage >= GARBAGE_LIMIT) {
          // The adapter has lost the thread (a clone mid-reply, a reset): start it over.
          garbage = 0;
          await init();
          break;
        }
      }

      settle(answered);
      if (rpm != null) {
        if (rpm > 0 && lastRpm === 0) {
          caughtAt = now();
        }
        lastRpm = rpm;
      }
      lastAnswered = answered;
      const engine = answered && (rpm == null ? !has('rpm') : rpm > 0);
      if (engine) {
        lastEngineAt = now();
        if (!engineOn) {
          engineOn = true;
          handlers.onEngine(true);
        }
      } else if (engineOn && now() - lastEngineAt > ENGINE_OFF_MS) {
        engineOn = false;
        handlers.onEngine(false);
      }
      if (lastRpm === 0 && lastAnswered) {
        await sleep(ENGINE_STOPPED_POLL_MS);
      } else if (!engineOn) {
        await sleep(ENGINE_OFF_POLL_MS);
      }
    }
  };

  return {
    start: async () => {
      if (running) {
        return;
      }
      running = true;
      unsubscribe = transport.onData(onChunk);
      try {
        await run();
      } catch (error) {
        handlers.onError(error instanceof Error ? error : new Error(String(error)));
      } finally {
        running = false;
        unsubscribe?.();
        unsubscribe = null;
      }
    },
    stop: () => {
      running = false;
      waiting?.('');
    },
  };
}
