# Mobile v2 — Settings

Date: 2026-10-17. Replaces the interim `src/app/settings/index.tsx` (Appearance and Sign out only).

References: Rovy's settings (one page of grouped cards: profile, preferences, automation, recording
reliability) and Odo's (driving automation, alerts, data, help). Dropped: leaderboard privacy, Pro,
Discord, invite friends, XP levels, CarPlay, app-icon switcher, sprint tracking, navigation,
notifications, language and calendar. **Route matching** is deferred to the Frequent Routes feature
(its own spec, next): the radius setting only means something once drives are grouped into routes.

## Storage

Everything is stored on the device (AsyncStorage), loaded at start-up, as Appearance is today. A new
`preferencesStore` holds:

| Key | Values | Default |
|---|---|---|
| `units` | `metric` (km/h, km) · `imperial` (mph, mi) | `metric` |
| `temperature` | `c` · `f` | `c` |
| `mapStyle` | `standard` · `muted` · `satellite` · `hybrid` | `muted` (today's look) |
| `autoStart` | boolean | `true` |
| `autoStop` | boolean | `true` |
| `autoStopMinutes` | `1 · 3 · 5 · 10` | `3` (today's 180 s) |
| `ignoreShortDrives` | boolean (under 300 m **or** under 60 s) | `false` |
| `speedAlert` | boolean | `false` |
| `speedAlertKmh` | 40–150, step 10 (shown and picked in the chosen unit) | `100` |
| `powerMode` | `maximum` · `balanced` · `efficient` | `balanced` |

Appearance stays in `appearanceStore`. A value from storage that is unknown falls back to its default.

## Page (`src/app/settings/index.tsx`, top to bottom)

**Presentation**: the gear on every tab header opens Settings as a **bottom sheet** (Expo Router
`presentation: 'modal'` on the `settings` route in the root stack, so iOS shows its page sheet that
slides up and swipes down to close, as Rovy does). Inside: a large "Settings" title at the top left
and a glass ✕ (`GlassButton`) at the top right; once scrolled, the title shrinks into a centred
"Settings" in a pinned, blurred header (the trip page's header pattern), with the ✕ staying put. The
sheet's own top inset is used, not the status bar's (as `asSheet` does on the trip page). Sub-choices
inside Settings (map style, delete account) open as `BottomSheet`s over it.

Rovy look: grouped `Card`s with icon rows and hairlines, section labels like Home.

1. **Profile card**: initial in an accent circle, email (`/auth/me`), active vehicle; opens the Garage tab.
2. **PREFERENCES**: Units (`km/h · mph` pills), Temperature (`°C · °F`), Appearance (`System · Light ·
   Dark`), Map style (row opens `OptionSheet`).
3. **DRIVING**: Auto-start (switch), Auto-stop (switch) with "Stop after" (`1 · 3 · 5 · 10 min` pills,
   shown when on), Ignore short drives (switch, subtitle "Under 300 m or 1 min"), Speed alert (switch)
   with the limit (stepper −/+ by 10, shown when on).
4. **POWER MODE**: `Maximum · Balanced · Efficient` with one line under it saying what the choice does.
5. **RECORDING RELIABILITY**: 2 × 2 tiles. *Always Allow* and *Precise Location* read the live
   permission (`expo-location`): a green check when fine, otherwise "Fix" opening iOS Settings
   (`Linking.openSettings`). *Low Power Off* and *Open the App* are tips.
6. **ACCOUNT & DATA**: Export drives (CSV), Sign out, Delete account (red).
7. **ABOUT**: Contact support (`mailto:`), Privacy policy (link), version from `expo-application`,
   Lucide credit.

## Behaviour

- **Units**: `useUnits()` returns `{speed(mps), distance(m), speedUnit, distanceUnit, kmhToUnit}`
  formatters for the chosen system; every screen that shows speed or distance uses it, so a change
  shows at once (React Compiler memoises, so a global read would go stale). Pure conversions live in
  `utils/units.ts`. Backend values stay metric.
- **Temperature**: the weather card converts °C to °F when chosen.
- **Map style**: `mapType` for every `MapView` (`muted` = iOS `mutedStandard`, Android `standard`).
- **Auto-start / auto-stop**: `recordingStore` reads the switches; auto-stop waits `autoStopMinutes`
  instead of the fixed 180 s (the stable-cluster check stays).
- **Ignore short drives**: when a drive ends under 300 m or 60 s it is discarded (not uploaded) and the
  finished-drive screen is skipped; a toast says "Short drive not saved".
- **Speed alert**: while recording, going over the limit vibrates (`expo-haptics`, warning) and shows a
  red banner on the Drive screen; it fires again only after dropping below the limit and 60 s passing.
- **Power mode**: maps to `expo-location` accuracy and update interval / distance in the tracking
  code: maximum = `BestForNavigation`, 1 s / 0 m; balanced = `High`, 2 s / 5 m; efficient = `Balanced`,
  5 s / 15 m. Applies from the next drive.
- **Export**: `GET /api/v1/trips/export.csv` (the user's ended trips: date, start, end, vehicle, km,
  duration, avg / top speed, score, from / to address). Saved with `expo-file-system`, shared with
  `expo-sharing`.
- **Delete account**: a sheet asks for the password; `DELETE /api/v1/auth/me` with `{password}` checks it
  (403 when wrong), deletes the user (cascades to vehicles, trips, points, events, fuel logs), returns
  204; the app clears storage and signs out. Errors stay in the sheet.

## Packages

`expo-haptics`, `expo-sharing`, `expo-application` (all in Expo Go; installed with `npx expo install`).

## Testing

- Jest: `utils/units` conversions and formatting; `preferencesStore` defaults, persistence and unknown
  values; `recordingStore` auto-stop delay, auto-start off, short-drive discard, speed-alert throttle.
- Backend: CSV rows and header; delete-account password check and cascade (unit tests with mocks).
- Simulator: each section renders; units switch updates Home, Logbook and a trip page.

## Implementation notes (2026-10-17)

- Contact support and Privacy policy rows show only once `SUPPORT_EMAIL` / `PRIVACY_POLICY_URL` in
  `src/config/links.ts` are filled in. Version comes from `expo-constants` (`expoConfig.version`):
  `expo-application` would report Expo Go's own version in Expo Go, so it was not used.
- Gauge in mph: speed and scale are converted with the same factor, so the needle is unchanged; the
  classic dial's tick labels are uneven in mph (scales are chosen in km/h).

## Profile (2026-10-17)

Tapping the Settings profile card opens **My Profile** as a second sheet (Rovy), and Edit opens **Edit
Profile** as a third. Social parts of Rovy's profile (friends, levels, Add Friends, public stats) are left
out; the row under the name is Drives · Streak · Score and "My Stats" uses the Home all-time numbers.

- Backend migration `20261017_0008`: `users.handle` (unique, `^[a-z0-9_]{3,20}$`, stored lowercase),
  `users.avatar` (deferred bytea) and `avatar_updated_at`. `GET /auth/me` returns `handle`, `avatar_url`.
  `GET /auth/handle-available?handle=` → `{handle, available, reason}`; `PATCH /auth/me {handle}`
  (409 taken, 422 format); `GET/PUT/DELETE /auth/me/avatar` (same rules as vehicle photos).
- Edit Profile: avatar with a camera badge (take, choose square-cropped, remove; uploads at once) and the
  handle field with an orange "@", a live check 0.4 s after typing stops (✓ / ✗ with the reason), and
  Save enabled only for a changed, valid, free handle.
