/** Empty replies in a row before a PID the car claims to support is dropped (clones over-claim). */
export const EMPTY_STRIKES = 3;

/**
 * PIDs a supported-PIDs bitmap reply lists. `base` is the request (`00`, `20`, `40`, `60`); bit 7
 * of the first byte is `base + 1`, and so on through 32 bits.
 */
export const decodeSupported = (base: string, bytes: number[]): string[] => {
  const start = parseInt(base, 16);
  const out: string[] = [];
  bytes.slice(0, 4).forEach((byte, i) => {
    for (let bit = 0; bit < 8; bit++) {
      if (byte & (0x80 >> bit)) {
        out.push((start + i * 8 + bit + 1).toString(16).toUpperCase().padStart(2, '0'));
      }
    }
  });
  return out;
};

/** Which PIDs to keep asking for: the car's own list, minus any that keep coming back empty. */
export class SupportTracker {
  private codes = new Set<string>();
  private empties = new Map<string, number>();

  setSupported(codes: string[]) {
    this.codes = new Set(codes.map((c) => c.toUpperCase()));
    this.empties.clear();
  }

  has(code: string): boolean {
    return this.codes.has(code.toUpperCase());
  }

  list(): string[] {
    return [...this.codes];
  }

  recordOk(code: string) {
    this.empties.delete(code);
  }

  /** Returns true when this empty reply got the PID dropped. */
  recordEmpty(code: string): boolean {
    const n = (this.empties.get(code) ?? 0) + 1;
    this.empties.set(code, n);
    if (n >= EMPTY_STRIKES) {
      this.codes.delete(code);
      this.empties.delete(code);
      return true;
    }
    return false;
  }
}
