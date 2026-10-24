# Telemetry sources step 4: eco driving and battery health

Spec: `docs/superpowers/specs/2026-10-25-mobile-v2-telemetry-sources-design.md`, section 2 (eco
driving, battery health) and order-of-work step 4.

## Decisions taken while planning

- **Coasting** is time moving (> 5 km/h, engine running) with the throttle closed. Throttle
  position (PID 11) rarely reads 0 even when closed (12–18 % is common), so "closed" means within
  2 points of the lowest throttle seen on that drive. Shown as a share of moving time.
- **High RPM** threshold: 3,000 rpm, or 2,500 for diesel (from the vehicle's fuel type).
- **Warm-up**: from the first engine-running second to coolant ≥ 70 °C. A drive that starts with
  coolant already at 70 °C or more is a warm start (0 s). Never reaching 70 °C gives no figure.
- **Battery is per vehicle, from the live link, not per drive.** A drive usually starts after the
  engine is running, so its 1 Hz samples rarely hold the engine-off voltage or the start dip. The
  link watches instead: resting voltage is the last reading with the engine off (ignition on) for
  at least 10 s; the start dip is the lowest voltage from 2 s before to 3 s after RPM goes above 0.
  Both are saved on the paired adapter (`lastState`) and shown on the adapter card.
- **Fast voltage while the engine is off.** The cranking dip lasts about a second. With the
  ignition on and the engine off, the poll loop reads the adapter's own voltage (`ATRV`, a quick
  adapter-level reply) every round and checks RPM every round, instead of the 10 s slow poll; the
  10 s slow poll stays for the ignition off (computer silent).
- Thresholds (amber): resting below 12.2 V, start dip below 9.6 V.

## Tasks

1. `series.summarize` gains `coastShare`, `highRpmS`, `warmupS` (options: high-RPM threshold);
   `carTotals` gains time-weighted coasting share, total high-RPM time and average warm-up; tests.
2. `obd/battery.ts` (pure): `BatteryWatch` turns a voltage/RPM stream into resting and start-dip
   readings; tests including a start-stop restart.
3. Poll loop: engine-off-but-answering rounds read `ATRV` + RPM every round; `parseVoltage`; tests.
4. Link: feed `BatteryWatch`, save results on the adapter; `finalizeObd` gets the high-RPM
   threshold from the vehicle's fuel type.
5. Show: Trip Detail and Car stats tiles (coasting, high RPM, warm-up); adapter card battery line
   with amber thresholds.
6. Simulator: voltage dips to ~10.3 V for a moment when the engine starts; verify on the simulator.
