# Telemetry sources step 1: speed, idle and drive end

Spec: `docs/superpowers/specs/2026-10-25-mobile-v2-telemetry-sources-design.md`, section 1 and order-of-work step 1.

## Decisions taken while planning

- **Top speed per fix, not per drive.** Each fix uses adapter speed when the adapter has a reading
  under 2 s old, so the top speed is the highest of the chosen speeds. This already avoids GPS
  spikes whenever the adapter is there; the spec's "≥ 50 % of the drive" rule adds nothing on top,
  so the spec is updated to match.
- **Idle via a per-fix `engineOn` flag**, so the same rule applies on the phone, in the upload
  (`idle_time_seconds`) and in local stats. Fixes without adapter data keep today's rule.
- **Drive end** fires from adapter and recording updates (event-driven, works in the background)
  with a 5 s interval as a foreground backup. It ends the drive at the moment the engine stopped,
  never while GPS says the car moved in the last 30 s (a Bluetooth dropout mid-drive).

## Tasks

1. `src/obd/sourceRules.ts` (pure): `adapterReading`, `applyAdapter`, `fillGap`, `engineEndAt`;
   tests in `src/obd/__tests__/sourceRules.test.ts`.
2. `obdStore`: `engineOnAt` (last RPM > 0) and `distanceM` (adapter distance, speed × time, gaps
   capped at 5 s); store tests.
3. `recordingStore.ingest`: apply the adapter reading to fresh fixes; GPS-gap fill; `Sample` gains
   `speedSource` and `engineOn`; recording tests for both.
4. `tripMetrics.idleSeconds`: skip fixes with `engineOn === false`; test.
5. `useObdLink`: engine-off drive end through `engineEndAt`, respecting the Auto-stop setting.
6. Simulator: 5 s start-stop at the lights each loop; dev-only "Engine off / on" control on the
   Telemetry tab.
7. Verify: typecheck, lint, Jest; on the iOS Simulator, a drive with the simulated adapter shows
   adapter speed, survives the start-stop pause, and ends 60 s after "Engine off".
