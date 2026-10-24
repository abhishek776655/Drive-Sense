# DriveSense v2: Telemetry data sources and additions

Date: 2026-10-25
App: `drive-sense-v2` (Expo SDK 57)
Builds on: `2026-10-25-mobile-v2-telemetry-obd-design.md`

## Goal

Decide which source wins when the phone and the OBD-II adapter both measure the same thing, and add
the measurements only one of them can make. Without an adapter everything works as it does today.

## 1. Source rules (both can measure)

| Data point | Rule |
|---|---|
| **Speed** (live display, speeding, top speed) | Each live fix takes adapter speed when the adapter has a reading under 2 s old, else GPS (fix tagged `speedSource`). Top speed is the highest chosen speed, so adapter readings are never mixed with GPS spikes. Braking and acceleration events only compare fixes from the same source. |
| **Distance** | GPS stays primary (it matches the route on the map). Where GPS has a gap > 10 s and the adapter has speed, the gap's distance is filled from adapter speed × time. |
| **Idle time** | Adapter: engine running (RPM > 0) and speed 0. GPS rule only without adapter data. |
| **Drive start** | Adapter going live starts a drive when "Start with car adapter" is on (already built). GPS rule unchanged. |
| **Drive end** | With an adapter: the drive ends 60 s after the car's computer stops answering altogether (ignition off), timed at the moment the engine stopped, unless GPS shows the car moving in the last 30 s. RPM 0 with the computer still answering (engine off at a long red light, auto start-stop) never ends it; that waits for the GPS parked rule. Without an adapter: the 3-minute GPS rule. The Telemetry tab shows the state (Engine running / Engine off · ignition on / Parked · ignition off, with a countdown while recording). |
| **Harsh braking / rapid acceleration** | Phone detects (accelerometer + GPS) as today. With adapter speed in that moment, an event is kept only if adapter speed changed by ≥ 60 % of what the event implies within ±2 s; otherwise it is dropped (phone picked up or dropped). |
| **Speeding** | Uses the speed rule above. |
| **Elevation** | Phone barometer (relative altitude) for climb and descent; GPS altitude for absolute height. Adapter pressure is not used for elevation. |
| **Outside temperature** | Weather service for the conditions card; adapter ambient (`46`) only on the Telemetry tab. |
| **Vehicle** | VIN mismatch keeps its banner and gains a "Switch to <vehicle>" button when the VIN belongs to another vehicle in Garage. |

Server scoring: the drive's uploaded points carry the chosen speed, so the server scores what the
phone shows. Sample gains `speedSource: 'gps' | 'obd'` so this stays traceable.

## 2. Adapter-only additions

- **Fuel cost:** Settings gains fuel price per litre (or gallon) and currency. Trip Detail and the
  Car stats show cost; stats sum it for the period. Cost is worked out when shown, so changing the
  price applies to old drives too (stated in Settings).
- **Range left:** Garage gains tank capacity per vehicle. Range = fuel level % × tank ÷ average
  economy (last 30 days, or all time if less). Shown on Telemetry and the Garage adapter card.
- **Fuel wasted idling:** fuel flow integrated while idle; on Trip Detail and in Car stats.
- **Eco driving:** coasting share (throttle ≈ 0 while moving, engine on), time above 3,000 rpm
  (diesel 2,500), warm-up time (engine start until coolant ≥ 70 °C). Trip Detail and Car stats.
- **Battery health:** resting voltage (engine off, adapter connected) and start-up dip (lowest
  voltage in the 5 s around the engine starting). Garage card shows the last of each; amber below
  12.2 V resting or 9.6 V dip.

`ObdStats` gains `idleFuelL`, `coastShare`, `highRpmS`, `warmupS`, `startDipV`, `restingV`;
`summarize` computes them, so they exist for every drive recorded from now on (older drives show
the tiles as missing, which the card already handles).

## 3. Phone-sensor additions (no adapter needed)

- **Barometer elevation:** `expo-sensors` Barometer relative altitude, sampled with each GPS fix;
  replaces GPS altitude for climb/descent when present.
- **Cornering force:** gyroscope yaw rate × speed → lateral G; peak per turn; Trip Detail shows the
  hardest corner and joins the G-Force card.
- **Road roughness:** vertical accelerometer variance per 100 m, bucketed smooth / fair / rough;
  rough spots shown on the route map.
- **Phone use while driving:** time the app is in the foreground and the screen unlocked while
  moving above 10 km/h, excluding the Drive and Telemetry tabs (navigation use). Shown on Trip
  Detail; not part of the score in v1.

## 4. Order of work

1. Source rules for speed, idle and drive end (biggest effect on every drive with an adapter).
2. Event cross-check.
3. Fuel cost, range, idle fuel (settings + Garage fields first).
4. Eco driving and battery health.
5. Phone sensors (barometer first, then cornering, roughness, phone use).

Each step is its own plan and commit; the spike from the OBD spec (real adapter, locked phone)
still gates steps 1 and 2 on a real phone.

## 5. Testing

- Pure functions for each rule with recorded GPS + adapter traces (tunnel gap, auto start-stop,
  phone dropped mid-drive, adapter disconnect).
- `summarize` cases for every new `ObdStats` field.
- Simulator adapter gains a start-stop pause at lights, a cold start and a battery dip so each
  rule can be seen end to end on the iOS Simulator.

## 6. Out of scope

Trouble-code reading (car-health spec), server-side storage of OBD data, Android Auto showing OBD
values, using phone use in the score.
