import type {AdapterLink} from './bleTransport';
import {PROMPT} from './elm327';

/**
 * A pretend ELM327 adapter in a pretend car, for development builds (the iOS Simulator has no
 * Bluetooth). It answers the same text commands a real adapter does, so everything above the
 * Bluetooth layer runs for real: poll loop, store, Telemetry tab, recorder, Trip Detail.
 */
export const SIM_DEVICE_ID = 'drivesense-simulator';
export const SIM_DEVICE_NAME = 'DriveSense Simulator';
export const SIM_VIN = 'MA3EWDE1S00000001';

/** One loop of the pretend drive, in seconds: idle, pull away, cruise, brake, idle. */
export const CYCLE_S = 60;
const CRUISE_KMH = 80;
/** rpm per km/h in each gear. */
const GEAR_RATIOS = [118, 68, 47, 36, 29];
const SHIFT_UP_RPM = 2900;
const IDLE_RPM = 800;

export interface SimCar {
  speed: number;
  rpm: number;
  throttle: number;
  load: number;
  maf: number;
  coolant: number;
  intakeTemp: number;
  map: number;
  baro: number;
  fuelLevel: number;
  voltage: number;
  ambient: number;
  runTime: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Seconds into each loop when the engine stops at the lights (auto start-stop), and restarts. */
export const START_STOP = [56, 59] as const;

/** Dev control: switch the pretend engine off (a parked car with the ignition on) and back on. */
export const simControls = {engineOn: true};

const engineOff = (car: SimCar): SimCar => ({...car, speed: 0, rpm: 0, throttle: 0, load: 0, maf: 0, map: car.baro, voltage: 12.4});

/** The car `elapsedS` seconds after the engine started. Pure, so tests can check any moment. */
export const simCar = (elapsedS: number): SimCar => {
  const t = elapsedS % CYCLE_S;
  let speed = 0;
  let throttle = 0;
  if (t >= 5 && t < 25) {
    // Pulling away: quick at first, easing off near cruising speed.
    speed = CRUISE_KMH * (1 - Math.exp(-(t - 5) / 6));
    throttle = 55 - (t - 5) * 1.5;
  } else if (t >= 25 && t < 45) {
    speed = CRUISE_KMH + 3 * Math.sin((t - 25) / 3);
    throttle = 20 + 4 * Math.sin((t - 25) / 2);
  } else if (t >= 45 && t < 55) {
    speed = CRUISE_KMH * (1 - (t - 45) / 10);
  }
  const gear = speed < 1 ? -1 : GEAR_RATIOS.findIndex((r, i) => speed * r <= SHIFT_UP_RPM || i === GEAR_RATIOS.length - 1);
  const rpm = gear < 0 ? IDLE_RPM + 20 * Math.sin(t) : Math.max(IDLE_RPM + 200, speed * GEAR_RATIOS[gear]);
  const load = clamp(throttle * 0.9 + 18, 0, 100);
  const warm = 1 - Math.exp(-elapsedS / 40);
  const car: SimCar = {
    speed: Math.round(speed),
    rpm: Math.round(rpm),
    throttle: clamp(throttle, 0, 100),
    load,
    maf: 1.5 + (rpm * load) / 100 * 0.011,
    coolant: Math.round(24 + 66 * warm),
    intakeTemp: 34,
    map: Math.round(30 + load * 0.7),
    baro: 100,
    fuelLevel: clamp(62 - elapsedS / 300, 0, 100),
    voltage: 14.2,
    ambient: 29,
    runTime: Math.round(elapsedS),
  };
  return t >= START_STOP[0] && t < START_STOP[1] ? engineOff(car) : car;
};

const hex = (n: number) => clamp(Math.round(n), 0, 255).toString(16).toUpperCase().padStart(2, '0');
const word = (n: number) => {
  const v = clamp(Math.round(n), 0, 0xffff);
  return hex(v >> 8) + hex(v & 0xff);
};
const pct = (n: number) => hex((n * 255) / 100);

/** Data bytes (hex) per Mode 01 PID, the inverse of the SAE formulas in `pids.ts`. */
const ANSWERS: Record<string, (c: SimCar) => string> = {
  '01': () => '81076500', // check-engine light on, 1 stored code
  '04': (c) => pct(c.load),
  '05': (c) => hex(c.coolant + 40),
  '0B': (c) => hex(c.map),
  '0C': (c) => word(c.rpm * 4),
  '0D': (c) => hex(c.speed),
  '0F': (c) => hex(c.intakeTemp + 40),
  '10': (c) => word(c.maf * 100),
  '11': (c) => pct(c.throttle),
  '1F': (c) => word(c.runTime),
  '2F': (c) => pct(c.fuelLevel),
  '33': (c) => hex(c.baro),
  '42': (c) => word(c.voltage * 1000),
  '46': (c) => hex(c.ambient + 40),
};

/** The supported-PIDs bitmap for one range (`00`, `20`, `40`), with the "next range" bit. */
const bitmap = (base: number): string => {
  let bits = 0;
  for (let pid = base + 1; pid <= base + 32; pid++) {
    const code = pid.toString(16).toUpperCase().padStart(2, '0');
    const isNext = pid === base + 32 && Object.keys(ANSWERS).some((k) => parseInt(k, 16) > pid);
    if (ANSWERS[code] || isNext) {
      bits |= 1 << (base + 32 - pid);
    }
  }
  return word(bits >>> 16) + word(bits & 0xffff);
};

const VIN_REPLY = (() => {
  const bytes = ['01', ...[...SIM_VIN].map((ch) => hex(ch.charCodeAt(0)))];
  const frames = [`0:4902${bytes.slice(0, 4).join('')}`, `1:${bytes.slice(4, 11).join('')}`, `2:${bytes.slice(11, 18).join('')}`];
  return `014\r${frames.join('\r')}`;
})();

/** Reply text (without the prompt) for one command, given the car right now. */
export const simReply = (command: string, car: SimCar): string => {
  const cmd = command.trim().toUpperCase();
  if (cmd === 'ATZ') {
    return 'ELM327 v1.5';
  }
  if (cmd.startsWith('AT')) {
    return 'OK';
  }
  if (cmd === '0902') {
    return VIN_REPLY;
  }
  if (cmd.startsWith('01') && cmd.length === 4) {
    const pid = cmd.slice(2);
    if (['00', '20', '40'].includes(pid)) {
      return `41${pid}${bitmap(parseInt(pid, 16))}`;
    }
    const answer = ANSWERS[pid];
    return answer ? `41${pid}${answer(car)}` : 'NO DATA';
  }
  return '?';
};

/** A connected pretend adapter. The car's clock starts when it connects (the engine starts). */
export function createSimAdapter(now: () => number = Date.now): AdapterLink {
  const startedAt = now();
  const listeners = new Set<(chunk: string) => void>();
  let open = true;
  return {
    id: SIM_DEVICE_ID,
    name: SIM_DEVICE_NAME,
    write: async (text) => {
      if (!open) {
        throw new Error('Simulator adapter disconnected');
      }
      const car = simCar((now() - startedAt) / 1000);
      const reply = simReply(text, simControls.engineOn ? car : engineOff(car));
      // A real adapter takes a few tens of ms per answer; this keeps the loop at a realistic pace.
      setTimeout(() => listeners.forEach((l) => l(`${reply}\r\r${PROMPT}`)), 40);
    },
    onData: (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    disconnect: async () => {
      open = false;
    },
    onDisconnect: () => () => {},
  };
}
