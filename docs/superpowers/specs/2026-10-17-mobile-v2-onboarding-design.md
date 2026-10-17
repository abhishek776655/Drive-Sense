# DriveSense v2: onboarding

Date: 2026-10-17
App: `drive-sense-v2` (Expo SDK 57), backend: `backend/`

## Goal

A Rovy-style first-run flow, with soft animations: create an account with a username and
password, set up the profile and first vehicle, set a driving rhythm, grant permissions and
accept the safety terms.

## Decisions

- **Sign-up:** handle and password, plus an optional email for recovery (option C).
- **Steps:** account → photo → ride type → vehicle → frequency → location → notifications →
  safety → done.
- **Frequency** drives three things: a weekly goal (A), the streak unit (B) and smart defaults (C).
- **Notifications** are real and local: "Drive saved" and "You forgot to end your drive".
- **Animations** use RN `Animated` only, with no new animation library.

## 1. Backend

### Schema (migration `20261017_0009_onboarding.py`)
- `users.email` becomes nullable. The unique index stays; Postgres allows many NULLs.
- `users.driving_frequency` Text, nullable, check `IN ('daily','most','weekends','rarely')`.
- `users.weekly_goal` SmallInteger, nullable, check `BETWEEN 1 AND 14`.
- `users.terms_accepted_at` timestamptz, nullable.

### Auth
- `POST /auth/register` body `{handle, password, email?}`:
  - The handle must pass `handle_problem` and be free, otherwise **409** `{"detail": "That handle is taken."}`.
  - The email is optional; if given, it must be unique, otherwise 409.
  - The password must be at least 8 characters.
  - Returns the same token response as today.
- `POST /auth/login` body `{identifier, password}`. An identifier containing `@` followed by
  more characters and a `.` is matched as an email, case-insensitively. Anything else is
  normalised as a handle (a leading `@` is dropped). Legacy `{email, password}` keeps working.
- `PATCH /auth/me` adds optional fields:
  - `driving_frequency`: setting it fills `weekly_goal` with the default if none is set yet
  - `weekly_goal`
  - `email`: settable once, if empty; 409 if already taken
  - `accept_terms: true`: sets `terms_accepted_at = now()` once
- `UserRead` adds `driving_frequency`, `weekly_goal`, `terms_accepted_at` and `email: str | None`.
- Default weekly goal: daily 7, most 4, weekends 2, rarely 1.

### Streaks and goal
- `streak_unit(frequency)`: `'weeks'` for weekends or rarely, otherwise `'days'`.
- A week streak counts consecutive ISO weeks (Monday start, in the user's time zone) with at
  least one drive, ending in the current week or the week before.
- `home-stats` adds `streak_unit` and `week_goal: {target, done} | null`. `done` counts drives
  since Monday 00:00 local time. `streak_days` keeps its name; its value is in `streak_unit`.
- Achievements: `goal_1` "Goal getter" (the weekly goal met once) and `goal_4` "On a roll" (met
  4 weeks in a row), both in the Consistency category.

## 2. Mobile flow

- `src/app/(auth)/welcome.tsx` is the first auth screen (`initialRouteName`): the road logo, the
  wordmark, a line of copy, a "Get started" button (to `/onboarding`), and an "I already have an
  account" link (to `/login`).
- The login field is labelled "Username or email" and sends `{identifier, password}`.
- `src/app/onboarding.tsx` is reachable signed out (step 1) and signed in (steps 2–9). The root
  stack lists it in both protected groups.
- **Gate:** in `RootStack`, a signed-in user whose `terms_accepted_at` is null is routed to
  `/onboarding`.
- Step state lives in `src/stores/onboardingStore.ts`: the current step, plus answers not yet saved
  (ride type, frequency). It persists to AsyncStorage under `onboarding_v1`, so quitting resumes.
  It is cleared on finish and on sign-out.
- Steps (`src/components/onboarding/steps/*.tsx`), each `{onNext, onBack}`:
  1. **AccountStep:** handle (live availability check), password (8+), optional email. Calls
     register and then signs in.
  2. **PhotoStep:** pick or take an avatar, uploaded with the existing avatar endpoint. Skippable.
  3. **RideStep:** Car or Motorbike cards.
  4. **VehicleStep:** make and model picker (the existing `PickerField` and catalogue), year, HP
     (optional), fuel pills. Creates the vehicle with `vehicleStore.create`.
  5. **FrequencyStep:** four cards. Saves `driving_frequency` with `PATCH /auth/me`, then applies
     the smart defaults: daily or most sets `autoStart` on and `powerMode` balanced; rarely sets
     `autoStart` off.
  6. **LocationStep:** asks for foreground permission, then background. Denying it still
     continues, and a note says auto-start needs "Always".
  7. **NotificationsStep:** asks for notification permission. "Not now" skips.
  8. **SafetyStep:** six terms, an "I have read and accept these terms" checkbox, and Continue
     (enabled only once checked). Sends `accept_terms: true`.
  9. **DoneStep:** "You're in, @handle." Start driving replaces the route with `/(tabs)/drive`.
- The look: full-bleed accent background; white text; a white pill button whose label is the dark
  accent; a translucent back chip. Colours come from new theme tokens (`onboardingInk`,
  `onboardingSoft`), with no raw literals in components.

## 3. Animation

- `src/components/onboarding/StepTransition.tsx`: on a step change the old content fades out and
  moves 24 pt toward the exit side (220 ms), and the new content springs in from the other side
  (damping 18, stiffness 160). The direction follows forward or back.
- `src/components/onboarding/Stagger.tsx`: children fade up 12 pt, 60 ms apart, on mount.
- `ChoiceCard`: when selected it springs to scale 1.02, the check pops in (scale 0 → 1), and a
  light haptic plays.
- `ProgressBar`: the width animates to `(step) / 8`.
- `PillButton`: scales to 0.97 while pressed; opacity 0.5 when disabled.
- Location art: the dotted path draws with an animated `strokeDashoffset`, and the end dot pulses.
- Notification art: three cards drop in one after another (translateY −16 → 0, opacity 0 → 1,
  120 ms apart).
- Done art: the check strokes on, and 12 dots burst out and fade.
- `AccessibilityInfo.isReduceMotionEnabled()` keeps only the opacity animations.

## 4. Notifications

- `expo-notifications`, local only. `src/notifications/driveNotifications.ts`:
  - `notifyDriveSaved(drive, score)` is called when an **auto-ended** drive finishes:
    "Drive saved", "12.4 km · 23 min · Score 92".
  - `scheduleForgotten()` and `cancelForgotten()` act while recording with **auto-stop off**.
    Every time the car moves, a 15-minute notification is (re)scheduled: "You forgot to end your
    drive", "Tap to stop it and save your stats." It is cancelled when the drive ends.
  - Both are skipped when the `notifications` preference is off or permission is not granted.
- Tapping a notification opens `drivesensev2://drive`.
- Settings → Driving gains a "Notifications" switch (the `notifications` preference, default true).

## 5. Testing

- Backend: register with a handle (and the taken case), login by handle and by email, PATCH
  frequency setting the default goal, `accept_terms`, the week-streak helper, week-goal counting,
  and the goal achievements.
- Mobile:
  - onboarding store (advance, back, persist, reset)
  - smart defaults per frequency
  - notification decisions (pure helpers)
  - login identifier payload
- Simulator: walk the whole flow with a throwaway account.
