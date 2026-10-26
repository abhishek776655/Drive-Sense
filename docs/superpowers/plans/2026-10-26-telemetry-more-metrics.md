# Telemetry More Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Read fuel rate, torque, gear and odometer from cars that report them above PID 0x80, and show torque, power, acceleration, today's fuel, fuel litres, odometer and average speed on Telemetry, the cluster and Garage.

**Architecture:** The OBD poll loop learns the 0x80/0xA0 supported-PID bitmaps and reads new PIDs into `useObdStore.values`; pure functions in `obd/derive.ts` turn them into `ObdDerived` values (fuel flow, torque, power, acceleration); `obd/tiles.ts` and the cluster/Garage components only format what the store holds.

**Tech Stack:** Expo 54 / React Native 0.81, TypeScript, Zustand, Jest (`npx jest`), `npx tsc --noEmit`, `npx expo lint`. All commands run from `drive-sense-v2/`.

Spec: `docs/superpowers/specs/2026-10-26-mobile-v2-telemetry-more-metrics-design.md`.

## Global Constraints

- Real readings only: a value the car does not report has no tile, graph or row. Nothing is estimated from engine load or engine size.
- No default tank size: fuel litres only when `preferences.tankLitres[vehicleId]` is set.
- Units: torque Nm (lb-ft imperial, ×0.737562), power kW (hp imperial, ×1.341022), acceleration m/s² signed in both systems, odometer km/mi one decimal.
- Speed and RPM stay polled every cycle (~4/s); new PIDs only in the flow (every 2nd cycle), slow, or once tiers.
- Colours and fonts come from `useAppTheme()` (app) or `CLUSTER_INK` (cluster), never literals.
- Comments match the codebase: short, explain why, British-neutral plain English.
- Commit only the files a task touches. The working tree has the user's unrelated WIP (`TwinLayout.tsx` dial size, auth screens, notifications, …): never `git add -A`; stage hunks with `git apply --cached` when a file holds both.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File map

| File | Responsibility | Tasks |
|---|---|---|
| `src/obd/pids.ts` | PID keys, codes, decoders | 1, 2, 3 |
| `src/obd/pollLoop.ts` | what to ask the adapter, when | 1, 2, 3 |
| `src/obd/derive.ts` | fuel flow, torque, power, `AccelEstimator` | 1, 2, 3 |
| `src/obd/useObdLink.ts` | wires loop values → store, derive | 1, 2, 3 |
| `src/stores/obdStore.ts` | `ObdDerived`, `HistoryPoint` | 2, 3, 5 |
| `src/obd/tiles.ts` | Telemetry tiles | 2, 3, 4 |
| `src/stats/todayFuel.ts` (new) | today's fuel and mileage for a vehicle | 4 |
| `src/app/(tabs)/telemetry.tsx` | Telemetry screen | 4, 5 |
| `src/components/telemetry/ThisDriveCard.tsx` | this drive's figures | 4 |
| `src/cluster/clusterData.ts`, `useClusterData.ts`, `parts/pages.tsx`, `parts/PowerPage.tsx` (new), `twin/TwinLayout.tsx` | cluster | 6 |
| `src/db/obdRepos.ts`, `src/app/(tabs)/garage.tsx` | odometer last state, Garage tile | 7 |

---

### Task 1: Fuel rate from PID 0x9D (bitmaps 0x80/0xA0)

**Files:**
- Modify: `src/obd/pids.ts`, `src/obd/pollLoop.ts:44` (`SUPPORTED_BASES`) and the flow choice in `run()`, `src/obd/derive.ts` (`fuelFlowLph`), `src/obd/useObdLink.ts` (`derive`, `onValue`)
- Test: `src/obd/__tests__/core.test.ts`, `src/obd/__tests__/pollLoop.test.ts`

**Interfaces:**
- Produces: `PidKey` gains `'fuelRateGs'` (code `9D`, 4 bytes, tier `flow`, decode `(256A+B)/50` g/s).
- Produces: `fuelFlowLph({fuelRate, fuelRateGs, maf}, fuel): number | null` — priority 5E → 9D → MAF.
- Produces: `SUPPORTED_BASES = ['00','20','40','60','80','A0']`.

- [ ] **Step 1: Failing tests**

`core.test.ts`, in the existing `'works out fuel flow from air flow, or uses the fuel rate'` block's describe:
```ts
  it('turns the car\'s fuel rate in g/s (PID 9D) into L/h, after 5E and before air flow', () => {
    // 0.28 g/s of petrol (745 g/L) is 1.35 L/h, as Car Scanner showed for the test car.
    expect(fuelFlowLph({fuelRateGs: 0.28}, 'petrol')).toBeCloseTo(1.353, 2);
    expect(fuelFlowLph({fuelRateGs: 0.28}, 'diesel')).toBeCloseTo(1.212, 2);
    expect(fuelFlowLph({fuelRate: 4, fuelRateGs: 0.28, maf: 10}, 'petrol')).toBe(4);
    expect(fuelFlowLph({fuelRateGs: 0.28, maf: 10}, 'petrol')).toBeCloseTo(1.353, 2);
    expect(fuelFlowLph({fuelRateGs: 0.28}, 'electric')).toBeNull();
  });

  it('decodes PID 9D engine fuel rate', () => {
    // 0x000E = 14 → 14 / 50 = 0.28 g/s; bytes C, D are the vehicle rate, ignored.
    expect(PIDS.fuelRateGs.decode([0x00, 0x0e, 0x00, 0x0e])).toBeCloseTo(0.28);
    expect(PIDS.fuelRateGs.code).toBe('9D');
  });
```
(add `PIDS` to the file's imports from `'../pids'`.)

`pollLoop.test.ts`, new test:
```ts
  it('follows the bitmaps past 0x80 and reads fuel rate from 9D when the car has no 5E', async () => {
    // 0160 lists 0x80 (its last bit); 0180 lists 9D (byte 3, bit 4) and A0; 01A0 lists nothing more.
    const car = {...CAR, '0120': '41 20 00 02 20 01', '0140': '41 40 00 00 00 01', '0160': '41 60 00 00 00 01', '0180': '41 80 00 00 00 09', '01A0': '41 A0 00 00 00 00', '019D': '41 9D 00 0E 00 0E'};
    const {transport, sent} = fakeAdapter(car);
    const h = handlers();
    const loop = createPollLoop(transport, {...h, onValue: (k, v, at) => (h.onValue(k, v, at), h.values.length >= 30 && loop.stop())}, {sleep: never});
    await loop.start();
    expect(sent).toEqual(expect.arrayContaining(['0180', '01A0']));
    expect(h.values).toContainEqual(['fuelRateGs', 0.28]);
    expect(sent).not.toContain('015E');
  });
```
(Bitmap check: `0180` bytes `00 00 00 09` → bit 4 of byte 3 is PID 0x80+24+5 = 0x9D, last bit = 0xA0.)

- [ ] **Step 2: Run, expect FAIL**

Run: `npx jest src/obd/__tests__/core.test.ts src/obd/__tests__/pollLoop.test.ts`
Expected: FAIL — `PIDS.fuelRateGs` undefined; `0180` never sent.

- [ ] **Step 3: Implement**

`pids.ts` — add to `PidKey` union `| 'fuelRateGs'`, and to `PIDS` after `fuelRate`:
```ts
  // Engine fuel rate in g/s (bytes C, D are the whole vehicle's; one engine, same value).
  fuelRateGs: {code: '9D', bytes: 4, tier: 'flow', decode: (b) => word(b) / 50},
```
`pollLoop.ts`:
```ts
const SUPPORTED_BASES = ['00', '20', '40', '60', '80', 'A0'];
```
and in `run()` replace the flow choice:
```ts
      if (cycle % 2 === 0) {
        // The car's own fuel figure first (L/h, then g/s), air flow last.
        const flow = (['fuelRate', 'fuelRateGs', 'maf'] as PidKey[]).find(has);
        if (flow) {
          plan.push(flow);
        }
      }
```
`derive.ts` — replace `fuelFlowLph`:
```ts
/**
 * Fuel flow in L/h: the car's own fuel rate (PID 5E, L/h, or 9D, g/s) when it has one, else worked
 * out from air flow (PID 10). Null for fuels where neither says anything useful (CNG, electric).
 */
export const fuelFlowLph = (
  {fuelRate, fuelRateGs, maf}: {fuelRate?: number | null; fuelRateGs?: number | null; maf?: number | null},
  fuel: FuelType,
): number | null => {
  if (fuelRate != null) {
    return fuelRate;
  }
  const f = FUEL[fuel];
  if (!f) {
    return null;
  }
  if (fuelRateGs != null) {
    return (fuelRateGs * 3600) / f.gPerL;
  }
  return maf == null ? null : (maf / f.afr / f.gPerL) * 3600;
};
```
`useObdLink.ts` `derive()`: `fuelFlowLph({fuelRate: v.fuelRate?.v, fuelRateGs: v.fuelRateGs?.v, maf: v.maf?.v}, fuel)`; and in `onValue` re-derive on `fuelRateGs` too:
```ts
        if (key === 'speed' || key === 'maf' || key === 'fuelRate' || key === 'fuelRateGs') {
```

- [ ] **Step 4: Run, expect PASS**; then the whole suite, typecheck, lint

Run: `npx jest && npx tsc --noEmit && npx expo lint src/obd`
Expected: all pass, no output from tsc/lint.

- [ ] **Step 5: Commit**
```bash
git add src/obd/pids.ts src/obd/pollLoop.ts src/obd/derive.ts src/obd/useObdLink.ts src/obd/__tests__/core.test.ts src/obd/__tests__/pollLoop.test.ts
git commit -m "fix(v2): fuel flow from the car's g/s fuel rate (PID 9D); scan PIDs past 0x80"
```

---

### Task 2: Torque and power

**Files:**
- Modify: `src/obd/pids.ts`, `src/obd/pollLoop.ts` (flow tier, once reads), `src/obd/derive.ts`, `src/stores/obdStore.ts` (`ObdDerived`, `EMPTY_DERIVED`), `src/obd/useObdLink.ts`, `src/obd/tiles.ts`
- Test: `src/obd/__tests__/core.test.ts`, `pollLoop.test.ts`, `tiles.test.ts`

**Interfaces:**
- Consumes: Task 1's flow-tier block in `run()`.
- Produces: `PidKey` gains `'torquePct'` (62, 1 byte, flow, `A − 125`), `'torqueRef'` (63, 2 bytes, once, `256A+B`).
- Produces: `torqueNm(pct, ref): number | null`, `powerKw(nm, rpm): number | null` in `derive.ts`.
- Produces: `ObdDerived` gains `torqueNm: number | null; powerKw: number | null`.
- Produces: tiles `id: 'torque'` and `id: 'power'`; formatters `torqueUnits(nm, units)`, `powerUnits(kw, units)` in `tiles.ts`.

- [ ] **Step 1: Failing tests**

`core.test.ts`:
```ts
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
```
`pollLoop.test.ts`:
```ts
  it('reads reference torque once and actual torque every second cycle, when listed', async () => {
    // 0160 bitmap: 62 and 63 (byte 0 bits 1, 2), plus nothing beyond.
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
```
`tiles.test.ts`:
```ts
  it('shows torque and power only when worked out, in the chosen units', () => {
    const d = {...NONE, torqueNm: 150, powerKw: 50};
    const tiles = obdTiles({}, d, metric);
    expect(tiles.find((t) => t.id === 'torque')).toMatchObject({value: '150', unit: 'Nm'});
    expect(tiles.find((t) => t.id === 'power')).toMatchObject({value: '50', unit: 'kW'});
    const imp = obdTiles({}, d, {...metric, units: 'imperial'});
    expect(imp.find((t) => t.id === 'torque')).toMatchObject({value: '111', unit: 'lb-ft'});
    expect(imp.find((t) => t.id === 'power')).toMatchObject({value: '67', unit: 'hp'});
    expect(obdTiles({}, NONE, metric).map((t) => t.id)).not.toContain('torque');
  });
```
Update `NONE` in `tiles.test.ts` to `{fuelFlow: null, economy: null, boost: null, gear: null, torqueNm: null, powerKw: null}`.

- [ ] **Step 2: Run, expect FAIL** — `npx jest src/obd` (missing PIDs/functions/tiles).

- [ ] **Step 3: Implement**

`pids.ts`: union `| 'torquePct' | 'torqueRef'`; in `PIDS`:
```ts
  torquePct: {code: '62', bytes: 1, tier: 'flow', decode: (b) => b[0] - 125},
  torqueRef: {code: '63', bytes: 2, tier: 'once', decode: word},
```
`pollLoop.ts` — once-reads loop: `for (const key of ['baro', 'runTime', 'distSinceClear', 'torqueRef', 'status'] as PidKey[])`; flow block after the fuel push:
```ts
        if (has('torquePct')) {
          plan.push('torquePct');
        }
```
`derive.ts`:
```ts
/** Engine torque in Nm: the car's actual torque (% of its reference, PID 62) × the reference (PID 63). */
export const torqueNm = (pct: number | null | undefined, refNm: number | null | undefined): number | null =>
  pct == null || refNm == null ? null : (pct / 100) * refNm;

/** Power in kW from torque and RPM (P = T × ω). */
export const powerKw = (nm: number | null | undefined, rpm: number | null | undefined): number | null =>
  nm == null || rpm == null ? null : (nm * rpm * 2 * Math.PI) / 60 / 1000;
```
`obdStore.ts`: `ObdDerived` adds `torqueNm: number | null; powerKw: number | null;`; `EMPTY_DERIVED` adds `torqueNm: null, powerKw: null`.
`useObdLink.ts` `derive()`:
```ts
    const torque = torqueNm(v.torquePct?.v, v.torqueRef?.v);
    store().setDerived({
      fuelFlow: flow,
      economy: economyL100(flow, v.speed?.v ?? null),
      boost: boostKpa(v.map?.v, v.baro?.v),
      gear: v.speed?.v === 0 ? 0 : gear.add(v.rpm?.v, v.speed?.v),
      torqueNm: torque,
      powerKw: powerKw(torque, v.rpm?.v),
    });
```
and re-derive on `'torquePct'` and `'rpm'` in `onValue` (add to the key list).
`tiles.ts`:
```ts
export const torqueUnits = (nm: number, units: UnitSystem) => (units === 'imperial' ? {value: String(Math.round(nm * 0.737562)), unit: 'lb-ft'} : {value: String(Math.round(nm)), unit: 'Nm'});
export const powerUnits = (kw: number, units: UnitSystem) => (units === 'imperial' ? {value: String(Math.round(kw * 1.341022)), unit: 'hp'} : {value: String(Math.round(kw)), unit: 'kW'});
```
In `obdTiles`, after the throttle tile:
```ts
  if (derived.torqueNm != null) {
    tiles.push({id: 'torque', label: 'Torque', ...torqueUnits(derived.torqueNm, opts.units), icon: 'sync', tone: 'normal'});
  }
  if (derived.powerKw != null) {
    tiles.push({id: 'power', label: 'Power', ...powerUnits(derived.powerKw, opts.units), icon: 'flash', tone: 'normal'});
  }
```
Fix any other `ObdDerived` literal the compiler flags (`npx tsc --noEmit`).

- [ ] **Step 4: Run, expect PASS** — `npx jest && npx tsc --noEmit && npx expo lint src/obd src/stores`

- [ ] **Step 5: Commit**
```bash
git add src/obd/pids.ts src/obd/pollLoop.ts src/obd/derive.ts src/obd/useObdLink.ts src/obd/tiles.ts src/stores/obdStore.ts src/obd/__tests__/
git commit -m "feat(v2): torque and power from the car's torque PIDs (62, 63)"
```

---

### Task 3: Acceleration, gear (A4), odometer (A6)

**Files:**
- Modify: `src/obd/pids.ts`, `src/obd/pollLoop.ts`, `src/obd/derive.ts`, `src/stores/obdStore.ts`, `src/obd/useObdLink.ts`, `src/obd/tiles.ts`
- Test: `core.test.ts`, `pollLoop.test.ts`, `tiles.test.ts`

**Interfaces:**
- Produces: `PidKey` gains `'gearCar'` (A4, 4 bytes, slow, decode returns gear `C >> 4`, or `-1` when byte A bit 0 is clear = unsupported) and `'odometer'` (A6, 4 bytes, once, km).
- Produces: `class AccelEstimator { add(kmh: number, at: number): number | null }` in `derive.ts`.
- Produces: `ObdDerived` gains `accelMps2: number | null`.
- Produces: tiles `'accel'` and `'odometer'`.

- [ ] **Step 1: Failing tests**

`core.test.ts`:
```ts
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

  it('decodes the car\'s gear (A4) and odometer (A6)', () => {
    expect(PIDS.gearCar.decode([0x01, 0x00, 0x30, 0x00])).toBe(3);
    expect(PIDS.gearCar.decode([0x01, 0x00, 0x00, 0x00])).toBe(0);
    expect(PIDS.gearCar.decode([0x00, 0x00, 0x30, 0x00])).toBe(-1);
    // 221208 tenths = 22120.8 km, as Car Scanner showed.
    expect(PIDS.odometer.decode([0x00, 0x03, 0x60, 0x18])).toBeCloseTo(22120.8);
  });
```
`tiles.test.ts`:
```ts
  it('shows acceleration signed and the odometer in the chosen units', () => {
    const t = obdTiles({odometer: {v: 22120.8}}, {...NONE, accelMps2: -1.24}, metric);
    expect(t.find((x) => x.id === 'accel')).toMatchObject({value: '−1.2', unit: 'm/s²'});
    expect(t.find((x) => x.id === 'odometer')).toMatchObject({value: '22,120.8', unit: 'km'});
    const imp = obdTiles({odometer: {v: 22120.8}}, NONE, {...metric, units: 'imperial'});
    expect(imp.find((x) => x.id === 'odometer')).toMatchObject({value: '13,745.0', unit: 'mi'});
  });
```
`pollLoop.test.ts`:
```ts
  it('reads the odometer once on connect', async () => {
    const car = {...CAR, '0120': '41 20 00 02 20 01', '0140': '41 40 00 00 00 01', '0160': '41 60 00 00 00 01', '0180': '41 80 00 00 00 01', '01A0': '41 A0 04 00 00 00', '01A6': '41 A6 00 03 60 18'};
    const {transport, sent} = fakeAdapter(car);
    const h = handlers();
    const loop = createPollLoop(transport, {...h, onValue: (k, v, at) => (h.onValue(k, v, at), h.values.length >= 30 && loop.stop())}, {sleep: never});
    await loop.start();
    expect(sent.filter((c) => c === '01A6')).toHaveLength(1);
    expect(h.values.find(([k]) => k === 'odometer')?.[1]).toBeCloseTo(22120.8);
  });
```
(`01A0` bytes `04 00 00 00` → bit 5 of byte 0 = 0xA6.)
Update `NONE` in `tiles.test.ts` with `accelMps2: null`.

- [ ] **Step 2: Run, expect FAIL** — `npx jest src/obd`

- [ ] **Step 3: Implement**

`pids.ts`: union `| 'gearCar' | 'odometer'`;
```ts
  // Byte A bit 0: gear reported; byte C high nibble: the gear (0 = neutral). −1 when not reported.
  gearCar: {code: 'A4', bytes: 4, tier: 'slow', decode: (b) => ((b[0] & 0x01) === 0 ? -1 : b[2] >> 4)},
  odometer: {code: 'A6', bytes: 4, tier: 'once', decode: (b) => (b[0] * 2 ** 24 + b[1] * 2 ** 16 + b[2] * 256 + b[3]) / 10},
```
`pollLoop.ts`: once-reads list adds `'odometer'`; re-read it with status: `if (cycle % STATUS_EVERY === 0 && has('odometer')) plan.push('odometer');`; slow list adds `'gearCar'`.
`derive.ts`:
```ts
/** Speed readings this far back count toward acceleration (km/h steps are too coarse for two readings). */
const ACCEL_WINDOW_MS = 1000;
const ACCEL_MIN_SPAN_MS = 800;
const ACCEL_MAX_GAP_MS = 3000;

/** Acceleration in m/s² from the adapter's speed: the slope over the last second of readings. */
export class AccelEstimator {
  private points: {t: number; v: number}[] = [];

  add(kmh: number, at: number): number | null {
    const last = this.points[this.points.length - 1];
    if (last && at - last.t > ACCEL_MAX_GAP_MS) {
      this.points = [];
    }
    this.points = [...this.points.filter((p) => at - p.t <= ACCEL_WINDOW_MS), {t: at, v: kmh / 3.6}];
    const n = this.points.length;
    if (n < 3 || at - this.points[0].t < ACCEL_MIN_SPAN_MS) {
      return null;
    }
    // Least-squares slope, so one rounded reading can't swing it.
    const mt = this.points.reduce((s, p) => s + p.t, 0) / n;
    const mv = this.points.reduce((s, p) => s + p.v, 0) / n;
    const num = this.points.reduce((s, p) => s + (p.t - mt) * (p.v - mv), 0);
    const den = this.points.reduce((s, p) => s + (p.t - mt) ** 2, 0);
    return den === 0 ? null : (num / den) * 1000;
  }
}
```
`obdStore.ts`: `ObdDerived.accelMps2: number | null`, `EMPTY_DERIVED.accelMps2: null`.
`useObdLink.ts` in `runSession`: `const accel = new AccelEstimator();` and in `onValue` for `key === 'speed'`: `latestAccel = accel.add(value, at);` (a `let latestAccel: number | null = null` beside `gear`), then `derive()` includes `accelMps2: latestAccel`. Gear: `gear: v.gearCar != null && v.gearCar.v >= 0 ? v.gearCar.v : v.speed?.v === 0 ? 0 : gear.add(v.rpm?.v, v.speed?.v)`. Log the first raw A4 value once per session: `if (key === 'gearCar' && !gearLogged) { gearLogged = true; void logBle(\`Car gear (A4): ${value}\`); }`.
`tiles.ts`:
```ts
const MI_PER_KM = 0.621371;
const oneDecimal = (n: number) => n.toLocaleString('en-US', {minimumFractionDigits: 1, maximumFractionDigits: 1});
```
In `obdTiles`, after power:
```ts
  if (derived.accelMps2 != null) {
    const a = derived.accelMps2;
    tiles.push({id: 'accel', label: 'Acceleration', value: `${a < 0 ? '−' : ''}${Math.abs(a).toFixed(1)}`, unit: 'm/s²', icon: 'trending-up', tone: 'normal'});
  }
```
At the end, before `return tiles`:
```ts
  const odo = v('odometer');
  if (odo != null) {
    const imperial = opts.units === 'imperial';
    tiles.push({id: 'odometer', label: 'Odometer', value: oneDecimal(imperial ? odo * MI_PER_KM : odo), unit: imperial ? 'mi' : 'km', icon: 'speedometer-outline', tone: 'normal'});
  }
```

- [ ] **Step 4: Run, expect PASS** — `npx jest && npx tsc --noEmit && npx expo lint src/obd src/stores`

- [ ] **Step 5: Commit**
```bash
git add src/obd/ src/stores/obdStore.ts
git commit -m "feat(v2): acceleration from adapter speed; the car's own gear and odometer"
```

---

### Task 4: Today's fuel, fuel litres, average speed, Engine temp rename

**Files:**
- Create: `src/stats/todayFuel.ts`, `src/stats/__tests__/todayFuel.test.ts`
- Modify: `src/obd/tiles.ts` (coolant label, fuel tile, opts), `src/app/(tabs)/telemetry.tsx` (pass opts), `src/components/telemetry/ThisDriveCard.tsx` (avg speed)
- Test: `src/obd/__tests__/tiles.test.ts`

**Interfaces:**
- Produces: `todayFuel(drives: CarDrive[], vehicleId: string, dayStartMs: number, live: {fuelUsedL: number | null; l100km: number | null} | null): {fuelL: number; l100km: number | null} | null`.
- Produces: `obdTiles` opts gain `todayL100km?: number | null; todayFuelL?: number | null; tankLitres?: number | null`.

- [ ] **Step 1: Failing tests**

`src/stats/__tests__/todayFuel.test.ts`:
```ts
import type {CarDrive} from '../carStats';
import {todayFuel} from '../todayFuel';

const drive = (startMs: number, fuelUsedL: number | null, avgL100km: number | null, vehicleId = 'v1'): CarDrive => ({
  startMs, vehicleId, durationS: 600,
  stats: {avgRpm: null, maxRpm: null, maxCoolantC: null, fuelUsedL, avgL100km, idleS: 0, coverage: 1},
});
const MIDNIGHT = Date.parse('2026-10-26T00:00:00+05:30');

describe("today's fuel", () => {
  it('adds today\'s saved drives and the live one: total fuel over total distance', () => {
    // 1 L over 20 km (5 L/100) + live 0.5 L over 5 km (10 L/100) → 1.5 L over 25 km = 6 L/100.
    const t = todayFuel([drive(MIDNIGHT + 3_600_000, 1, 5)], 'v1', MIDNIGHT, {fuelUsedL: 0.5, l100km: 10});
    expect(t?.fuelL).toBeCloseTo(1.5);
    expect(t?.l100km).toBeCloseTo(6);
  });

  it('leaves out yesterday and other vehicles', () => {
    const t = todayFuel([drive(MIDNIGHT - 1000, 9, 9), drive(MIDNIGHT + 1000, 9, 9, 'v2'), drive(MIDNIGHT + 2000, 1, 5)], 'v1', MIDNIGHT, null);
    expect(t?.fuelL).toBeCloseTo(1);
    expect(t?.l100km).toBeCloseTo(5);
  });

  it('is null with no fuel figures today', () => {
    expect(todayFuel([drive(MIDNIGHT + 1000, null, null)], 'v1', MIDNIGHT, null)).toBeNull();
    expect(todayFuel([], 'v1', MIDNIGHT, {fuelUsedL: null, l100km: null})).toBeNull();
  });
});
```
`tiles.test.ts`:
```ts
  it('calls coolant Engine temp, and shows fuel as percent and litres when the tank size is known', () => {
    expect(obdTiles({coolant: {v: 82}}, NONE, metric)[0]).toMatchObject({id: 'coolant', label: 'Engine temp'});
    const withTank = obdTiles({fuelLevel: {v: 28.63}}, NONE, {...metric, tankLitres: 50}).find((t) => t.id === 'fuelLevel');
    expect(withTank).toMatchObject({label: 'Fuel remaining', value: '29', unit: '% · 14.3 L'});
    const gallons = obdTiles({fuelLevel: {v: 28.63}}, NONE, {...metric, units: 'imperial', tankLitres: 50}).find((t) => t.id === 'fuelLevel');
    expect(gallons?.unit).toBe('% · 3.8 gal');
    expect(obdTiles({fuelLevel: {v: 28.63}}, NONE, metric).find((t) => t.id === 'fuelLevel')?.unit).toBe('%');
  });

  it("shows today's mileage and fuel when known", () => {
    const t = obdTiles({}, NONE, {...metric, todayL100km: 6, todayFuelL: 1.5});
    expect(t.find((x) => x.id === 'todayEconomy')).toMatchObject({label: 'Economy today', value: '6.0', unit: 'L/100 km'});
    expect(t.find((x) => x.id === 'todayFuel')).toMatchObject({label: 'Fuel today', value: '1.50', unit: 'L'});
  });
```

- [ ] **Step 2: Run, expect FAIL** — `npx jest src/stats/__tests__/todayFuel.test.ts src/obd/__tests__/tiles.test.ts`

- [ ] **Step 3: Implement**

`src/stats/todayFuel.ts`:
```ts
import type {CarDrive} from './carStats';

/**
 * A vehicle's fuel since `dayStartMs` (local midnight): today's saved drives plus the one recording
 * now. Economy is total fuel over total distance (a drive's distance is its fuel over its L/100 km).
 */
export const todayFuel = (
  drives: CarDrive[],
  vehicleId: string,
  dayStartMs: number,
  live: {fuelUsedL: number | null; l100km: number | null} | null,
): {fuelL: number; l100km: number | null} | null => {
  const parts = drives
    .filter((d) => d.vehicleId === vehicleId && d.startMs >= dayStartMs)
    .map((d) => ({fuelL: d.stats.fuelUsedL, l100km: d.stats.avgL100km}));
  if (live) {
    parts.push({fuelL: live.fuelUsedL, l100km: live.l100km});
  }
  let fuel = 0;
  let economyFuel = 0;
  let km = 0;
  let any = false;
  for (const p of parts) {
    if (p.fuelL == null) {
      continue;
    }
    any = true;
    fuel += p.fuelL;
    if (p.l100km != null && p.l100km > 0) {
      economyFuel += p.fuelL;
      km += (p.fuelL / p.l100km) * 100;
    }
  }
  return any ? {fuelL: fuel, l100km: km > 0 ? (economyFuel / km) * 100 : null} : null;
};
```
`tiles.ts`: coolant tile `label: 'Engine temp'`; opts type adds `todayL100km?: number | null; todayFuelL?: number | null; tankLitres?: number | null`; fuel tile becomes:
```ts
  const fuelLevel = v('fuelLevel');
  if (fuelLevel != null) {
    const litres = opts.tankLitres != null ? (fuelLevel / 100) * opts.tankLitres : null;
    const left = litres == null ? '' : opts.units === 'imperial' ? ` · ${fixed(litres / L_PER_US_GAL, 1)} gal` : ` · ${fixed(litres, 1)} L`;
    tiles.push({id: 'fuelLevel', label: 'Fuel remaining', value: String(Math.round(fuelLevel)), unit: `%${left}`, icon: 'color-fill', tone: fuelLevel < 10 ? 'warn' : 'normal'});
  }
```
after the `driveEconomy` tile:
```ts
  if (opts.todayL100km != null) {
    tiles.push({id: 'todayEconomy', label: `${economyLabel(opts.units, opts.mileage ?? 'l100')} today`, ...economy(opts.todayL100km, opts.units, opts.mileage), icon: 'calendar', tone: 'normal'});
  }
  if (opts.todayFuelL != null) {
    tiles.push({id: 'todayFuel', label: 'Fuel today', ...fuelVolume(opts.todayFuelL, opts.units), icon: 'water', tone: 'normal'});
  }
```
`telemetry.tsx`: compute and pass:
```ts
  const driveFuel = useDriveFuel();
  const version = useSyncStore((s) => s.version);
  const today = useMemo(() => {
    const db = getDb();
    if (!db || !vehicle) {
      return null;
    }
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    try {
      return todayFuel(carDrives(db), vehicle.id, midnight.getTime(), driveFuel);
    } catch {
      return null;
    }
    // `version`: the saved drives changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle?.id, version, driveFuel]);
```
and add `todayL100km: today?.l100km ?? null, todayFuelL: today?.fuelL ?? null, tankLitres: range.tankLitres` to the `obdTiles` opts (and to the `useMemo` deps).
`ThisDriveCard.tsx`: add a Stat after Fuel used — read `const avg = useRecordingStore((s) => avgSpeedMps(s.stats.distanceM, s.stats.movingSeconds));` and render `<Stat label="Avg speed" value={avg != null ? u.speed(avg) : '—'} unit={u.speedUnit} />`. Make the card render when recording even without fuel figures (the condition `econ || fuel` becomes `true` while a drive records).

- [ ] **Step 4: Run, expect PASS** — `npx jest && npx tsc --noEmit && npx expo lint src/obd src/stats "src/app/(tabs)/telemetry.tsx" src/components/telemetry`

- [ ] **Step 5: Commit**
```bash
git add src/stats/todayFuel.ts src/stats/__tests__/todayFuel.test.ts src/obd/tiles.ts src/obd/__tests__/tiles.test.ts "src/app/(tabs)/telemetry.tsx" src/components/telemetry/ThisDriveCard.tsx
git commit -m "feat(v2): today's mileage and fuel, fuel remaining in litres, live average speed, Engine temp"
```

---

### Task 5: Telemetry graphs (RPM, Power, Fuel flow, Acceleration)

**Files:**
- Modify: `src/stores/obdStore.ts` (`HistoryPoint`, `putValue`), `src/app/(tabs)/telemetry.tsx`
- Test: `src/stores/__tests__/obdStore.test.ts`

**Interfaces:**
- Consumes: `ObdDerived.powerKw`, `accelMps2`, `fuelFlow`; `powerUnits` from Task 2.
- Produces: `HistoryPoint` gains `power: number | null; accel: number | null`.

- [ ] **Step 1: Failing test** (`obdStore.test.ts`):
```ts
  it('keeps power and acceleration in each history point', () => {
    const s = useObdStore.getState();
    s.setDerived({fuelFlow: 2, economy: null, boost: null, gear: null, torqueNm: 100, powerKw: 30, accelMps2: 1.2});
    s.putValue('speed', 40, 1000);
    expect(useObdStore.getState().history.at(-1)).toMatchObject({power: 30, accel: 1.2, fuelFlow: 2});
  });
```
- [ ] **Step 2: Run, expect FAIL** — `npx jest src/stores/__tests__/obdStore.test.ts`
- [ ] **Step 3: Implement** — `HistoryPoint` adds `power: number | null; accel: number | null`; in `putValue` the point is
```ts
    const {fuelFlow, powerKw, accelMps2} = get().derived;
    const point: HistoryPoint = {at, rpm: values.rpm?.v ?? null, speed: value, fuelFlow, power: powerKw, accel: accelMps2};
```
In `telemetry.tsx` replace the single-RPM row with a 2×2 grid; each card only when its value has been seen in `history`:
```tsx
        <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.cardGap}}>
          {graphs.map((g) => (
            <View key={g.key} style={{flexBasis: '48%', flexGrow: 1}}>
              <Sparkline label={g.label} value={g.value} unit={g.unit} points={spark(g.pick)} color={g.color} />
            </View>
          ))}
        </View>
```
with, above `body`:
```ts
  const seen = (pick: (p: (typeof history)[number]) => number | null) => history.some((p) => pick(p) != null);
  const power = derived.powerKw != null ? powerUnits(derived.powerKw, u.units) : null;
  const flow = derived.fuelFlow != null ? fuelFlowUnits(derived.fuelFlow, u.units) : null;
  const graphs = [
    {key: 'rpm', label: 'RPM', value: values.rpm ? String(Math.round(values.rpm.v)) : '—', unit: 'rpm', pick: (p: HistoryPoint) => p.rpm, color: c.accent, show: true},
    {key: 'power', label: 'Power', value: power?.value ?? '—', unit: powerUnits(0, u.units).unit, pick: (p: HistoryPoint) => p.power, color: c.purple, show: seen((p) => p.power)},
    {key: 'flow', label: 'Fuel flow', value: flow?.value ?? '—', unit: fuelFlowUnits(0, u.units).unit, pick: (p: HistoryPoint) => p.fuelFlow, color: c.cyan, show: seen((p) => p.fuelFlow)},
    {key: 'accel', label: 'Acceleration', value: derived.accelMps2 != null ? derived.accelMps2.toFixed(1) : '—', unit: 'm/s²', pick: (p: HistoryPoint) => p.accel, color: c.green, show: seen((p) => p.accel)},
  ].filter((g) => g.show);
```
Re-add to `tiles.ts` (removed 2026-10-26 with the tile; the graph needs it):
```ts
export const fuelFlowUnits = (lph: number, units: UnitSystem) =>
  units === 'imperial' ? {value: fixed(lph / L_PER_US_GAL, 2), unit: 'gal/h'} : {value: fixed(lph, 1), unit: 'L/h'};
```
- [ ] **Step 4: Run, expect PASS** — `npx jest && npx tsc --noEmit && npx expo lint src/stores "src/app/(tabs)/telemetry.tsx" src/obd`
- [ ] **Step 5: Commit**
```bash
git add src/stores/obdStore.ts src/stores/__tests__/obdStore.test.ts "src/app/(tabs)/telemetry.tsx" src/obd/tiles.ts
git commit -m "feat(v2): Telemetry graphs for power, fuel flow and acceleration beside RPM"
```

---

### Task 6: Cluster — POWER view on the CAR page, CAR and THIS DRIVE rows

**Files:**
- Create: `src/cluster/parts/PowerPage.tsx`
- Modify: `src/cluster/clusterData.ts` (fields), `src/cluster/useClusterData.ts` (inputs), `src/cluster/parts/pages.tsx` (`CarPage`, `TripPage`), `src/cluster/twin/TwinLayout.tsx` (CAR pager views — hunk-stage only these lines)
- Test: `src/cluster/__tests__/clusterData.test.ts`

**Interfaces:**
- Consumes: `ObdDerived.torqueNm/powerKw`, `HistoryPoint.power`, `meterRadius`-style clear width `clearW` (already in `TwinLayout`), `torqueUnits`/`powerUnits`.
- Produces: `ClusterData` gains `torqueNm: number | null; powerKw: number | null; odometerKm: number | null; fuelLitres: number | null; avgSpeedMps: number | null`; `ClusterInput` gains `derived.torqueNm`, `derived.powerKw`, `tankLitres: number | null`, `recording.avgSpeedMps`.

- [ ] **Step 1: Failing test** (`clusterData.test.ts`, use the file's existing input builder):
```ts
  it('carries power, torque, odometer, fuel litres and average speed while the car answers', () => {
    const d = clusterData({...base, derived: {...base.derived, torqueNm: 120, powerKw: 40}, values: {...live, fuelLevel: {v: 28.63, at: NOW}, odometer: {v: 22120.8, at: NOW}}, tankLitres: 50, recording: {driveS: 600, distanceM: 5000, avgSpeedMps: 9}});
    expect(d).toMatchObject({powerKw: 40, torqueNm: 120, odometerKm: 22120.8, avgSpeedMps: 9});
    expect(d.fuelLitres).toBeCloseTo(14.3, 1);
    const off = clusterData({...base, values: {}, tankLitres: 50});
    expect(off).toMatchObject({powerKw: null, fuelLitres: null});
  });
```
(`base`, `live`, `NOW` are the names used in the existing test file; if they differ, use that file's builder names.)
- [ ] **Step 2: Run, expect FAIL** — `npx jest src/cluster`
- [ ] **Step 3: Implement**
`clusterData.ts`: add the fields; in `clusterData()`:
```ts
    torqueNm: adapter ? i.derived.torqueNm : null,
    powerKw: adapter ? i.derived.powerKw : null,
    // The odometer stays true with the engine off: the last reading, however old.
    odometerKm: i.values.odometer?.v ?? null,
    fuelLitres: fuelPct != null && i.tankLitres != null ? (fuelPct / 100) * i.tankLitres : null,
    avgSpeedMps: i.recording?.avgSpeedMps ?? null,
```
`useClusterData.ts`: pass `tankLitres: range.tankLitres`, `recording: {..., avgSpeedMps: avgSpeedMps(distanceM, movingSeconds)}` (read `movingSeconds` from the recording store).
`pages.tsx` `CarPage`: Coolant row `label: 'Engine temp'`; fuel row `value: String(Math.round(d.fuelPct)), unit: d.fuelLitres != null ? \`% · ${fuelVolume(d.fuelLitres, u.units).value} ${fuelVolume(d.fuelLitres, u.units).unit}\` : '%'`; add `if (d.odometerKm != null) rows.push({label: 'Odometer', value: String(Math.round(u.distanceValue(d.odometerKm * 1000) ?? 0)), unit: u.distanceUnit});`. `TripPage` recording view: add `{d.avgSpeedMps != null ? <Figure label="Avg speed" value={u.speed(d.avgSpeedMps)} unit={u.speedUnit} /> : null}`.
`PowerPage.tsx`: power big, torque beside it, 60 s two-line graph drawn with Skia like `GraphPage` in `statPages.tsx`, width `clearWidth`:
```tsx
import {Canvas, Path, Skia} from '@shopify/react-native-skia';
import {useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useUnits} from '../../hooks/useUnits';
import {powerUnits, torqueUnits} from '../../obd/tiles';
import {HISTORY_MS, useObdStore} from '../../stores/obdStore';
import {CLUSTER_INK} from '../accents';
import {Figure, pageStyles} from './pages';

const GRAPH_H = 70;

/** One swipe up from the CAR page: power big, torque beside it, and the last minute of both. */
export function PowerPage({clearWidth, accent, powerKw, torqueNm}: {clearWidth: number; accent: string; powerKw: number | null; torqueNm: number | null}) {
  const u = useUnits();
  const history = useObdStore((s) => s.history);
  const torqueRef = useObdStore((s) => s.values.torqueRef?.v ?? null);
  const w = Math.max(120, clearWidth);
  const paths = useMemo(() => {
    const now = history.length > 0 ? history[history.length - 1].at : 0;
    const line = (pick: (p: (typeof history)[number]) => number | null, max: number) => {
      const pts = history.flatMap((p) => {
        const v = pick(p);
        return v == null ? [] : [{x: w * (1 - (now - p.at) / HISTORY_MS), y: GRAPH_H * (1 - Math.max(0, v) / max)}];
      });
      return pts.length < 2 ? null : Skia.Path.MakeFromSVGString(pts.map((p, k) => `${k ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' '));
    };
    const peakKw = Math.max(1, ...history.map((p) => p.power ?? 0));
    return {power: line((p) => p.power, peakKw), torque: torqueRef ? line((p) => (p.power != null && p.rpm ? (p.power * 60000) / (2 * Math.PI * p.rpm) : null), torqueRef) : null};
  }, [history, w, torqueRef]);
  const p = powerKw != null ? powerUnits(powerKw, u.units) : null;
  const t = torqueNm != null ? torqueUnits(torqueNm, u.units) : null;
  return (
    <View style={styles.page}>
      <Text style={pageStyles.title}>POWER</Text>
      <View style={styles.figures}>
        <Figure label="Power" value={p?.value ?? '–'} unit={p?.unit} big />
        <Figure label="Torque" value={t?.value ?? '–'} unit={t?.unit} />
      </View>
      <Canvas style={{width: w, height: GRAPH_H, marginTop: 10}}>
        {paths.torque ? <Path path={paths.torque} style="stroke" strokeWidth={2} color={CLUSTER_INK.textDim} /> : null}
        {paths.power ? <Path path={paths.power} style="stroke" strokeWidth={2.5} color={accent} /> : null}
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {flex: 1, paddingTop: 14, alignItems: 'center'},
  figures: {flexDirection: 'row', gap: 28, alignItems: 'flex-end'},
});
```
(Torque history is recovered from power and RPM — `T = P·60000 / (2π·rpm)` — so `HistoryPoint` needs no torque field.)
`TwinLayout.tsx` CAR pager views:
```tsx
            { key: 'now', node: <CarPage d={d} /> },
            ...(d.powerKw != null || d.torqueNm != null ? [{ key: 'power', node: <PowerPage clearWidth={clearW} accent={accent} powerKw={d.powerKw} torqueNm={d.torqueNm} /> }] : []),
            { key: 'all', node: <AllTimePage /> },
```
- [ ] **Step 4: Run, expect PASS** — `npx jest && npx tsc --noEmit && npx expo lint src/cluster`
- [ ] **Step 5: Commit** — stage `TwinLayout.tsx` hunks only (the user's dial-size hunk stays out):
```bash
git diff -U1 -- src/cluster/twin/TwinLayout.tsx   # identify hunks; build a patch without the `dial = Math.min(rowH * 0.91` hunk
git apply --cached --recount <patch>
git add src/cluster/clusterData.ts src/cluster/useClusterData.ts src/cluster/parts/pages.tsx src/cluster/parts/PowerPage.tsx src/cluster/__tests__/clusterData.test.ts
git commit -m "feat(v2): cluster POWER view under CAR; Engine temp, fuel litres, odometer, avg speed"
```

---

### Task 7: Garage odometer

**Files:**
- Modify: `src/db/obdRepos.ts` (`AdapterState.odometerKm?`, `odometerAt?`), `src/obd/useObdLink.ts` (`saveLastState` keeps them), `src/app/(tabs)/garage.tsx` (tile)
- Create: `src/utils/odometerLabel.ts` + `src/utils/__tests__/odometerLabel.test.ts`
- Test: `src/db/__tests__/obdRepos.test.ts`

**Interfaces:**
- Produces: `odometerLabel(km: number, readAt: string, units: UnitSystem, now?: number): {value: string; label: string}` → e.g. `{value: '22,121', label: 'km · today'}`.

- [ ] **Step 1: Failing tests**

`odometerLabel.test.ts`:
```ts
import {odometerLabel} from '../odometerLabel';

const NOW = Date.parse('2026-10-26T18:00:00');

it('shows the last odometer reading with when it was read', () => {
  expect(odometerLabel(22120.8, '2026-10-26T13:02:00', 'metric', NOW)).toEqual({value: '22,121', label: 'km · today'});
  expect(odometerLabel(22120.8, '2026-10-25T13:02:00', 'metric', NOW)).toEqual({value: '22,121', label: 'km · yesterday'});
  expect(odometerLabel(22120.8, '2026-10-20T13:02:00', 'imperial', NOW)).toEqual({value: '13,745', label: 'mi · 6 days ago'});
});
```
`obdRepos.test.ts`: round-trip an adapter whose `lastState` has `odometerKm: 22120.8, odometerAt: '2026-10-26T13:02:00Z'` through `putAdapter`/`getAdapter` and expect both fields back.
- [ ] **Step 2: Run, expect FAIL** — `npx jest src/utils src/db`
- [ ] **Step 3: Implement**
`odometerLabel.ts`:
```ts
import type {UnitSystem} from './units';

const MI_PER_KM = 0.621371;
const DAY_MS = 86_400_000;

const startOfDay = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** "22,121" and "km · today": the adapter's last odometer reading and how old it is. */
export const odometerLabel = (km: number, readAt: string, units: UnitSystem, now = Date.now()): {value: string; label: string} => {
  const imperial = units === 'imperial';
  const days = Math.round((startOfDay(now) - startOfDay(Date.parse(readAt))) / DAY_MS);
  const when = days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
  return {value: Math.round(imperial ? km * MI_PER_KM : km).toLocaleString('en-US'), label: `${imperial ? 'mi' : 'km'} · ${when}`};
};
```
`obdRepos.ts` `AdapterState` adds:
```ts
  /** The car's odometer (PID A6) when last read, and when. */
  odometerKm?: number | null;
  odometerAt?: string | null;
```
`useObdLink.ts` `saveLastState` → `lastState`:
```ts
      odometerKm: values.odometer?.v ?? adapter.lastState?.odometerKm ?? null,
      odometerAt: values.odometer ? new Date(values.odometer.at).toISOString() : (adapter.lastState?.odometerAt ?? null),
```
and call `saveLastState(adapter)` from `onValue` when `key === 'odometer'`.
`garage.tsx`: read the selected vehicle's adapter (`getAdapter(getDb(), vehicle.id)` in a `useMemo` keyed on vehicle id and `useObdStore((s) => s.adapter?.lastState?.odometerAt)`), and when `lastState?.odometerKm != null` add a stat row tile:
```tsx
<GarageStatTile value={odo.value} label={odo.label} icon="speedometer-outline" />
```
placed in the row with Distance and Time (the row at `garage.tsx:122-124`).
- [ ] **Step 4: Run, expect PASS** — `npx jest && npx tsc --noEmit && npx expo lint src/db src/utils src/obd "src/app/(tabs)/garage.tsx"`
- [ ] **Step 5: Commit**
```bash
git add src/db/obdRepos.ts src/db/__tests__/obdRepos.test.ts src/obd/useObdLink.ts src/utils/odometerLabel.ts src/utils/__tests__/odometerLabel.test.ts "src/app/(tabs)/garage.tsx"
git commit -m "feat(v2): Garage shows the car's odometer from the adapter"
```

---

## Self-review (done while writing)

- Spec coverage: §1 PIDs → Tasks 1–3; §2 derived → 1–3; §3 tiles/graphs/this-drive → 2–5; §4 cluster → 6; §5 Garage → 7; §6 diagnostics: the `Car answers PIDs` line covers 80/A0 automatically once `SUPPORTED_BASES` grows (Task 1), and Task 3 logs the raw A4 gear.
- Names used across tasks: `fuelRateGs`, `torquePct`, `torqueRef`, `gearCar`, `odometer` (PidKey); `torqueNm`, `powerKw`, `accelMps2` (ObdDerived); `powerUnits`, `torqueUnits`, `fuelFlowUnits` (tiles); `HistoryPoint.power/accel`; `todayFuel`; `odometerLabel`. Consistent.
- Known check during execution: verify the exact `NONE`/builder names in the existing test files before pasting tests (Tasks 2–4, 6).
