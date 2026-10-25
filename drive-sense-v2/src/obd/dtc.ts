import type {Ionicons} from '@expo/vector-icons';

/**
 * Diagnostic trouble codes (OBD-II Mode 03): reading them from the adapter's reply, and a plain
 * meaning for the common generic ones. Codes not in the table get their system's description.
 */

type IconName = keyof typeof Ionicons.glyphMap;

export type DtcSystem = 'misfire' | 'fuelAir' | 'emissions' | 'sensor' | 'electrical' | 'idleSpeed' | 'transmission' | 'body' | 'network' | 'other';

export interface DtcInfo {
  code: string;
  meaning: string;
  system: DtcSystem;
  systemName: string;
  icon: IconName;
}

const SYSTEMS: Record<DtcSystem, {name: string; icon: IconName}> = {
  misfire: {name: 'Ignition / misfire', icon: 'flash'},
  fuelAir: {name: 'Fuel and air', icon: 'water'},
  emissions: {name: 'Emissions', icon: 'cloud'},
  sensor: {name: 'Sensor', icon: 'pulse'},
  electrical: {name: 'Electrical', icon: 'battery-half'},
  idleSpeed: {name: 'Speed and idle', icon: 'speedometer'},
  transmission: {name: 'Transmission', icon: 'cog'},
  body: {name: 'Body', icon: 'car'},
  network: {name: 'Network', icon: 'git-network'},
  other: {name: 'Engine', icon: 'construct'},
};

/** Common generic codes and what they mean, in plain words. */
const KNOWN: Record<string, [string, DtcSystem]> = {
  P0011: ['Camshaft timing too far advanced (bank 1)', 'sensor'],
  P0016: ['Crankshaft and camshaft positions out of step', 'sensor'],
  P0087: ['Fuel rail pressure too low', 'fuelAir'],
  P0101: ['Air flow sensor reading out of range', 'fuelAir'],
  P0102: ['Air flow sensor signal low', 'fuelAir'],
  P0106: ['Manifold pressure sensor reading out of range', 'sensor'],
  P0113: ['Intake air temperature sensor signal high', 'sensor'],
  P0117: ['Coolant temperature sensor signal low', 'sensor'],
  P0118: ['Coolant temperature sensor signal high', 'sensor'],
  P0121: ['Throttle position sensor reading out of range', 'sensor'],
  P0128: ['Engine running too cold (thermostat may be stuck open)', 'sensor'],
  P0130: ['Oxygen sensor circuit fault (bank 1, sensor 1)', 'sensor'],
  P0133: ['Oxygen sensor slow to respond (bank 1, sensor 1)', 'sensor'],
  P0135: ['Oxygen sensor heater fault (bank 1, sensor 1)', 'sensor'],
  P0141: ['Oxygen sensor heater fault (bank 1, sensor 2)', 'sensor'],
  P0171: ['Engine running lean (bank 1)', 'fuelAir'],
  P0172: ['Engine running rich (bank 1)', 'fuelAir'],
  P0174: ['Engine running lean (bank 2)', 'fuelAir'],
  P0175: ['Engine running rich (bank 2)', 'fuelAir'],
  P0217: ['Engine overheating', 'other'],
  P0234: ['Turbo overboost', 'fuelAir'],
  P0299: ['Turbo underboost (not enough boost)', 'fuelAir'],
  P0300: ['Random or multiple cylinder misfire', 'misfire'],
  P0301: ['Cylinder 1 misfire', 'misfire'],
  P0302: ['Cylinder 2 misfire', 'misfire'],
  P0303: ['Cylinder 3 misfire', 'misfire'],
  P0304: ['Cylinder 4 misfire', 'misfire'],
  P0305: ['Cylinder 5 misfire', 'misfire'],
  P0306: ['Cylinder 6 misfire', 'misfire'],
  P0325: ['Knock sensor circuit fault', 'misfire'],
  P0335: ['Crankshaft position sensor fault', 'sensor'],
  P0340: ['Camshaft position sensor fault', 'sensor'],
  P0400: ['Exhaust gas recirculation (EGR) flow fault', 'emissions'],
  P0401: ['EGR flow too low', 'emissions'],
  P0402: ['EGR flow too high', 'emissions'],
  P0420: ['Catalytic converter efficiency below threshold (bank 1)', 'emissions'],
  P0430: ['Catalytic converter efficiency below threshold (bank 2)', 'emissions'],
  P0440: ['Fuel vapour (EVAP) system fault', 'emissions'],
  P0441: ['EVAP purge flow incorrect', 'emissions'],
  P0442: ['Small leak in the fuel vapour system', 'emissions'],
  P0446: ['EVAP vent control fault', 'emissions'],
  P0455: ['Large leak in the fuel vapour system (check the fuel cap)', 'emissions'],
  P0456: ['Very small leak in the fuel vapour system', 'emissions'],
  P0457: ['Fuel cap loose or off', 'emissions'],
  P0500: ['Vehicle speed sensor fault', 'idleSpeed'],
  P0505: ['Idle control system fault', 'idleSpeed'],
  P0506: ['Idle speed lower than expected', 'idleSpeed'],
  P0507: ['Idle speed higher than expected', 'idleSpeed'],
  P0562: ['System voltage low', 'electrical'],
  P0563: ['System voltage high', 'electrical'],
  P0600: ['Engine computer communication fault', 'network'],
  P0700: ['Transmission control fault (more codes in the gearbox computer)', 'transmission'],
  P0715: ['Transmission input speed sensor fault', 'transmission'],
  P0730: ['Incorrect gear ratio', 'transmission'],
  P0741: ['Torque converter clutch stuck off', 'transmission'],
  P2002: ['Diesel particulate filter efficiency below threshold', 'emissions'],
  P2463: ['Diesel particulate filter soot build-up', 'emissions'],
  U0100: ['Lost communication with the engine computer', 'network'],
};

/** System a code belongs to from its letter and number range, for codes not in the table. */
const systemOf = (code: string): DtcSystem => {
  const letter = code[0];
  if (letter === 'B') {
    return 'body';
  }
  if (letter === 'U') {
    return 'network';
  }
  if (letter === 'C') {
    return 'other';
  }
  const group = code[2];
  return group === '1' || group === '2' ? 'fuelAir' : group === '3' ? 'misfire' : group === '4' ? 'emissions' : group === '5' ? 'idleSpeed' : group === '6' ? 'electrical' : group === '7' || group === '8' || group === '9' ? 'transmission' : 'other';
};

export const describeDtc = (code: string): DtcInfo => {
  const known = KNOWN[code];
  const system = known ? known[1] : systemOf(code);
  return {code, meaning: known ? known[0] : `${SYSTEMS[system].name} fault`, system, systemName: SYSTEMS[system].name, icon: SYSTEMS[system].icon};
};

/** Two bytes of a Mode 03 reply as a code: `01 33` → `P0133`. All zeros is padding, not a code. */
export const decodeDtc = (a: number, b: number): string | null => {
  if (a === 0 && b === 0) {
    return null;
  }
  const letter = 'PCBU'[a >> 6];
  const digit1 = (a >> 4) & 0x3;
  const rest = ((a & 0x0f) << 8) | b;
  return `${letter}${digit1}${rest.toString(16).toUpperCase().padStart(3, '0')}`;
};

/**
 * Every code in a Mode 03 reply. CAN cars put a count byte after `43` (so the line has an odd
 * number of bytes); older buses send three codes per line padded with zeros.
 */
export const parseDtcReply = (raw: string): string[] => {
  const codes: string[] = [];
  const lines = raw
    .replace(/>/g, '')
    .split(/[\r\n]+/)
    .map((l) => l.replace(/\s+/g, '').toUpperCase())
    .map((l) => l.replace(/^[0-9A-F]:/, ''));
  for (const line of lines) {
    if (!line.startsWith('43') || !/^[0-9A-F]+$/.test(line) || line.length % 2 !== 0) {
      continue;
    }
    let bytes = (line.slice(2).match(/../g) ?? []).map((h) => parseInt(h, 16));
    if (bytes.length % 2 === 1) {
      bytes = bytes.slice(1); // the CAN count byte
    }
    for (let i = 0; i + 1 < bytes.length; i += 2) {
      const code = decodeDtc(bytes[i], bytes[i + 1]);
      if (code && !codes.includes(code)) {
        codes.push(code);
      }
    }
  }
  return codes;
};
