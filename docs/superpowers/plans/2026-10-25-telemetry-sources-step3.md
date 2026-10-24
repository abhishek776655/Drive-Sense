# Telemetry sources step 3: fuel cost, range and idle fuel

Spec: `docs/superpowers/specs/2026-10-25-mobile-v2-telemetry-sources-design.md`, section 2 (fuel
cost, range left, fuel wasted idling) and order-of-work step 3.

## Decisions taken while planning

- **Where settings live:** fuel price, currency and tank sizes are phone settings
  (`preferencesStore`), like the OBD data itself. Tank size is per vehicle (`tankLitres` keyed by
  vehicle id), so it needs no server change to the vehicle record.
- **Price is stored per litre** and shown per litre or per US gallon with the unit setting.
  Currency is a symbol choice (₹, $, €, £), default ₹.
- **Cost is worked out when shown** (fuel used × today's price), so a price change applies to old
  drives too; Settings says so.
- **Range** = fuel level × tank ÷ economy. Economy is this vehicle's last 30 days with car data, or
  all its drives if there are none in 30 days. Hidden without a tank size or economy.
- **Idle fuel** = fuel flow while the engine runs at speed 0, from the 1 Hz samples, so it exists
  for drives recorded from now on; older drives simply don't show it.

## Tasks

1. `src/obd/fuel.ts` (pure): cost, money format, per-litre/per-gallon price conversion, range,
   range economy; tests.
2. `series.summarize` gains `idleFuelL`; `carTotals` gains `idleFuelL`; tests.
3. Preferences: `fuelPrice`, `currency`, `tankLitres` with sanitizing; tests.
4. `NumberSheet` component (number entry in a sheet). Settings: FUEL group with price and currency.
   Garage adapter card: tank size row and range.
5. Show: Trip Detail Car section (cost, idle fuel), Car stats (cost, idle fuel), Telemetry (range).
6. Verify: typecheck, lint, Jest; on the simulator set ₹105.5/L and a 45 L tank, drive, check
   Telemetry range, the drive's cost and idle fuel, and the stats.
