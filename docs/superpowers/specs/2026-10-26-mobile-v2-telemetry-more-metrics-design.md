# Telemetry: more engine metrics, graphs, cluster engine page, odometer

Date: 2026-10-26 · App: `drive-sense-v2` · Builds on: 2026-10-25 telemetry OBD, telemetry sources, cluster specs.

## Why

A real car (petrol, ELM327 over BLE) showed in Car Scanner: engine fuel rate, torque, odometer and gear, which
DriveSense never read. Fuel flow, mileage now/this drive, fuel used, cost and range were all blank on that car.
Root cause: the car reports fuel as **PID 0x9D (Engine Fuel Rate, g/s)**, not 0x5E or 0x10, and the
supported-PID scan stops at the 0x60 bitmap (`SUPPORTED_BASES = 00, 20, 40, 60`), so PIDs above 0x80 are never seen.

What that car reports (from Car Scanner, 2026-10-26): 04 load, 05 coolant, 06/07 trims, 0B MAP, 0C RPM, 0D speed,
0E timing, 0F intake temp, 11 throttle, 1F run time, 2F fuel level, 31 distance since clear, 33 baro, 42 module
voltage, 46 ambient, 51 fuel type, 62 actual torque %, 63 reference torque (175 Nm), 67 coolant A/B, 8E friction
torque, 9D engine fuel rate, A4 actual gear, A6 odometer. No MAF (10), no 5E, no oil temp (5C).

Rule kept from the 2026-10-25 spec: real readings only. A value the car does not report has no tile; nothing is
estimated from engine load or engine size.

## 1. Reading more of the car (obd/pollLoop.ts, obd/pids.ts, obd/supported.ts)

- `SUPPORTED_BASES` gains `80` and `A0` (covers PIDs 0x81–0xC0). The existing "last bit says the next bitmap
  exists" chain stops early on cars without them.
- New PIDs:

| Key | PID | Bytes | Decode | Tier |
|---|---|---|---|---|
| `fuelRateGs` | 9D | 4 | engine fuel rate `(256A+B)/50` g/s (bytes C, D: vehicle rate, ignored) | flow |
| `torquePct` | 62 | 1 | `A − 125` % | flow |
| `torqueRef` | 63 | 2 | `256A+B` Nm | once |
| `odometer` | A6 | 4 | `(A·2²⁴+B·2¹⁶+C·2⁸+D)/10` km | once (and on every reconnect) |
| `gear` | A4 | 4 | `C >> 4` (0 = neutral); null when byte A bit 0 says unsupported | slow |

- Flow tier: every 2nd cycle the loop asks for the fuel source (5E, else 9D, else 10) **and** `torquePct` when
  supported. Speed and RPM stay every cycle (~4/s).
- `odometer` is also re-read every `STATUS_EVERY` cycles so a long drive's end reading is fresh.

## 2. Derived values (obd/derive.ts, stores/obdStore.ts `ObdDerived`)

- `fuelFlowLph` takes `fuelRateGs`: priority 5E (L/h) → 9D (g/s × 3600 ÷ density) → MAF. Density per fuel type
  from the existing `FUEL` table. This alone revives fuel flow, mileage now, this drive, fuel used, cost, range.
- `torqueNm = torquePct/100 × torqueRef` (null unless both known; negative under engine braking, shown as is).
- `powerKw = torqueNm × rpm × 2π / 60 / 1000`; null unless torque and RPM known.
- `accelMps2`: `AccelEstimator` over the adapter's speed readings — slope across the last ~1 s (needs ≥ 0.8 s span
  and ≥ 3 readings; 1 km/h steps make two-point differences ±1 m/s² of noise). Null after a > 3 s gap.
- `gear`: the car's A4 value when reported; the existing `GearEstimator` otherwise.
- `HistoryPoint` gains `power`, `accel` (it has `rpm`, `fuelFlow`) for the sparklines.

## 3. Telemetry tab (app/(tabs)/telemetry.tsx, obd/tiles.ts)

Graphs (60 s sparklines, 2×2, each card hides when its value never arrived):
RPM | Power — Fuel flow (L/h) | Acceleration (m/s², signed).

Tiles (existing ones unchanged unless noted):
- **Engine temp** — the Coolant tile renamed (PID 05; same 105/115 °C warnings).
- **Fuel remaining** (was Fuel level) — both percent and litres: `29 %` with unit `· 14.3 L` (gal in imperial).
  Litres = fuel level % × the vehicle's tank size (`preferences.tankLitres`); percent alone when no tank size is
  set, with the existing low-fuel warning below 10 %.
- **Torque** (Nm; lb-ft imperial), **Power** (kW metric; hp imperial).
- **Mileage now** (existing), **Mileage this drive** (existing), **Mileage today** (new),
  **Fuel used today** (new).
- **Odometer** (km/mi, one decimal).
- No fuel-flow tile: its graph card carries the number.

"Today" = this vehicle since local midnight: drives saved today (`carDrives` → `carTotals`) plus the drive being
recorded (`useDriveFuel`). Mileage today = total fuel ÷ total distance, not an average of averages. Hidden until
there is fuel data.

This-drive card: adds **Avg speed** = distance ÷ moving seconds (`avgSpeedMps` from the recording store).

## 4. Cluster (cluster/parts/pages.tsx, cluster/clusterData.ts)

- No new centre page (the existing Engine page already holds the load meter). Instead the **CAR** page's vertical
  pager (today: Now → All time) gains a **POWER** view one swipe up from Now: a 60 s graph of power and torque
  (two lines, the cluster's accent and a dimmer second colour), with the current Power (hp/kW) big and Torque
  (Nm/lb-ft) beside it. Only present when the car reports torque. Its graph keeps to the clear width between
  the dial rims (see the load meter fix, 2026-10-26).
- **CAR** page: Coolant row renamed Engine temp; Fuel row shows `29 % · 14.3 L` like the Telemetry tile; adds
  Odometer.
- **THIS DRIVE** page: adds Avg speed (fuel used and mileage start working via §2).

## 5. Garage odometer (components/garage, db/obdRepos.ts)

- `AdapterState` (the paired adapter's last-seen state) gains `odometerKm` and its `readAt`; saved by
  `saveLastState` whenever the loop reads A6.
- The vehicle's Garage view shows an **Odometer** tile: `22,121 km · read today` (relative date). No tile without
  an adapter or without a reading.

## 6. Diagnostics

`Car answers PIDs: …` in the Adapter log (done 2026-10-26) now covers the 80/A0 ranges too.

## Out of scope

Fuel trims, O₂ sensors, timing advance, catalyst temperature, fuel-rail pressure, pedal positions, coolant
sensor B, Car Scanner's "power from fuel consumption", torque or fuel estimates for cars that report neither,
writing the odometer into the server-side vehicle record.

## Testing

- pids: 9D, 62, 63, A4 (incl. unsupported bit), A6 decoding.
- pollLoop: scans 80/A0 bitmaps when chained; asks 9D only when 5E is absent; torque only when supported; odometer
  once on connect and at the status interval.
- derive: g/s → L/h per fuel, torque/power, AccelEstimator (steady, launch, braking, gap, sparse readings).
- tiles: renamed Engine temp, fuel remaining % and litres (with/without tank size, imperial gallons), torque/power units, odometer, today tiles.
- today totals: saved drives + live drive, other vehicles and yesterday excluded.
- obdRepos: odometer kept in last state; Garage tile formatting.

## Build order

1. Fuel rate (bitmaps 80/A0 + 9D) — biggest win. 2. Torque and power. 3. Acceleration, gear A4, odometer.
4. Today totals, fuel litres, avg speed, Engine temp rename. 5. Graphs. 6. Cluster pages. 7. Garage odometer.
