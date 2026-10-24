# Telemetry sources step 2: event cross-check

Spec: `docs/superpowers/specs/2026-10-25-mobile-v2-telemetry-sources-design.md`, section 1 (harsh
braking / rapid acceleration) and order-of-work step 2.

## What the code does today

Braking and acceleration events come from the speed change between two consecutive fixes, live in
`recordingStore.ingest` and again for the final score in `tripMetrics.detectEvents`. The phone sends
those events and score to the server on finish (`TripFinishRequest`), and the server stores them as
sent, so fixing the phone fixes the server copy too. Step 1 already gives a fix adapter speed when
the adapter is fresh; this step covers the GPS-sourced fixes of a drive that has adapter data.

## Rule

For a braking or acceleration event between fixes `a` and `b`:
- both fixes from the adapter: keep (it is wheel speed);
- fixes from different sources: drop (already done live in step 1; now also in `detectEvents`);
- both GPS: look at adapter speeds from 2 s before `a` to 2 s after `b`. With at least two
  readings there, keep the event only if the adapter shows a change in the same direction of at
  least 60 % of the GPS change; with fewer, keep it (no evidence either way).

## Tasks

1. `src/obd/eventCheck.ts` (pure): `adapterConfirms(a, b, trace)` → `true | false | null`; tests.
2. `detectEvents(points, thresholds, {adapter})` and `tripMetrics(points, {adapter})` apply the
   rule; tests with a GPS spike, a real stop, a source switch and no adapter data.
3. `finishedDriveStore.show` passes the drive's adapter trace (`drive_obd_samples`, 1 Hz) before
   the OBD summary clears it.
4. ~~Live check~~ dropped while building: a fix only falls back to GPS once the adapter has been
   quiet for over 2 s, so live there is never adapter evidence before the event, and the readings
   after it don't exist yet. Live keeps step 1's same-source rule; the final score (sent to the
   server) applies the full cross-check.
5. Simulator: a dev "Adapter dropout" control (the adapter stops answering for 6 s) so a drive has
   GPS-sourced fixes and source switches in the middle; verify no false brake appears.
