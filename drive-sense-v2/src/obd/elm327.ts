/**
 * The ELM327 text protocol, without any transport: the init commands, building requests and
 * turning replies into data bytes. Replies are whatever arrived before the `>` prompt.
 */

/** Reset, echo off, linefeeds off, spaces off, headers off, automatic protocol. */
export const ELM_INIT = ['ATZ', 'ATE0', 'ATL0', 'ATS0', 'ATH0', 'ATSP0'];

export const PROMPT = '>';

export const pidRequest = (code: string) => `01${code}`;

/** Noise an adapter prints around an answer. */
const NOISE = /SEARCHING\.{3}|BUS INIT:?\s*\.*\s*(OK)?|\.{3}/g;

/** Replies that mean "no answer to this request", as opposed to garbage. */
const NO_ANSWER = ['NODATA', 'STOPPED', 'UNABLETOCONNECT', 'CANERROR', 'BUSERROR', 'BUSBUSY', 'FBERROR', 'DATAERROR', 'ERROR', '?'];

const lines = (raw: string) =>
  raw
    .replace(PROMPT, '')
    .replace(NOISE, '')
    .split(/[\r\n]+/)
    .map((l) => l.replace(/\s+/g, '').toUpperCase())
    .filter(Boolean);

/** True when the adapter answered but the car had nothing for this request (`NO DATA` and friends). */
export const isNoAnswer = (raw: string): boolean => lines(raw).some((l) => NO_ANSWER.includes(l));

const hexBytes = (hex: string): number[] | null => {
  if (!/^[0-9A-F]*$/.test(hex) || hex.length % 2 !== 0) {
    return null;
  }
  const out: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    out.push(parseInt(hex.slice(i, i + 2), 16));
  }
  return out;
};

/** Data bytes of every control unit's answer to Mode 01 `code`, in the order they arrived. */
export const parseReplies = (raw: string, code: string, bytes: number): number[][] => {
  const header = `41${code.toUpperCase()}`;
  const out: number[][] = [];
  for (const line of lines(raw)) {
    if (line.startsWith(header)) {
      const data = hexBytes(line.slice(header.length));
      if (data && data.length >= bytes) {
        out.push(data.slice(0, bytes));
      }
    }
  }
  return out;
};

/**
 * Data bytes of a Mode 01 reply for `code` (`41 0C 1A F8` → `[0x1A, 0xF8]`), or null when the reply
 * has none: `NO DATA`, an echo only, garbage. With several control units answering, the first wins.
 */
export const parseReply = (raw: string, code: string, bytes: number): number[] | null => parseReplies(raw, code, bytes)[0] ?? null;

/**
 * A supported-PIDs bitmap merged over every control unit that answered: the engine and the gearbox
 * each list their own PIDs, and either may answer first.
 */
export const parseBitmap = (raw: string, base: string): number[] | null => {
  const all = parseReplies(raw, base, 4);
  return all.length === 0 ? null : all.reduce((acc, b) => acc.map((byte, i) => byte | b[i]));
};

/**
 * The VIN from a Mode 09 PID 02 reply. CAN adapters split it over numbered frames (`0: 49 02 01 …`,
 * `1: …`), older buses repeat the `49 02 nn` header per line; both end up as the last 17 letters.
 */
export const parseVin = (raw: string): string | null => {
  const frames = lines(raw)
    .filter((l) => !/^[0-9A-F]{3}$/.test(l)) // the CAN length line, e.g. "014"
    .map((l) => l.replace(/^[0-9A-F]:/, ''));
  const hex = frames.map((l) => l.replace(/^4902[0-9A-F]{2}/, '')).join('');
  const data = hexBytes(hex);
  if (!data) {
    return null;
  }
  const text = String.fromCharCode(...data.filter((b) => b >= 0x30 && b <= 0x5a));
  return text.length >= 17 ? text.slice(-17) : null;
};
