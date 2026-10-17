# Mobile v2 — Achievements, XP and levels

Date: 2026-10-17. Reference: Rovy's Level & Achievements sheet.

## Rules

- Worked out from the user's ended drives on every request (`achievement_service`); nothing is stored.
  Each achievement is a running total crossing a threshold; the drive that crosses it gives
  `unlocked_at` and `trip_id`. Deleting a drive re-locks what it earned.
- 36 achievements in 7 categories: Distance (10 … 5,000 km), Drives (1 … 500), Time (1 … 50 h),
  Streak (3, 7, 14, 30 local days in a row), Night (1, 5, 10, 25 drives starting 20:00–05:00 local),
  G-force (0.5, 0.8 G), Smooth (1, 5, 25, 50 drives scoring 90+, and 10 drives of 1 km+ with no harsh
  braking or acceleration). Rovy's Speed category was replaced by Smooth: DriveSense rewards safe driving.
- XP is the sum of unlocked achievements' XP. Level thresholds 0, 100, 250, 450, 700, 1,000, … (each step
  50 XP more). Titles: Learner 1, Rookie 2, Commuter 3–4, Cruiser 5–7, Road Captain 8–10, Highway Hero
  11–13, Road Legend 14+.

## API

`GET /api/v1/achievements?tz=` → `{xp, level, title, level_start_xp, next_level_xp, unlocked, total,
achievements: [{id, category, title, description, xp, target, progress, unlocked_at, trip_id}]}`.

## App

- Settings: level card under the profile (badge, title, LVL chip, XP bar, n/36) → Achievements sheet.
- Achievements sheet (`settings/achievements`): level ring, title, XP pill, progress to the next level,
  Total XP and n/36, glass category chips, Unlocked (newest first, +XP, date, ✓) and Locked (closest
  first, faded, with a progress bar and "62 / 100 km"). Distance shows in the chosen units.
- Drive summary: once the trip is stored, an "Unlocked" card lists what that drive earned.
