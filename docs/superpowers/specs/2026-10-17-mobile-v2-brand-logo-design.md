# DriveSense v2: brand logo and first-launch intro

Date: 2026-10-17
App: `drive-sense-v2` (Expo SDK 57)

## Goal

Replace Expo's placeholder icon and splash with a real DriveSense logo, and play a short animated
brand intro the very first time the app is opened.

## Decisions

- Direction: **B4, the horizon road**: an orange road tapering to the horizon on a dark tile.
- Launch behaviour: **static logo splash on every launch; animated intro on the first launch only.**
- The logo also appears in the sign-in and sign-up header.

## 1. Logo assets

Masters live in `drive-sense-v2/assets/brand/` as SVG, drawn on a 1024 × 1024 grid:

| File | Content |
|---|---|
| `logo-tile.svg` | Black tile (`#000000`, the dark canvas) with the orange road (`#FF6D00`, the accent) |
| `logo-mark.svg` | The road alone on a transparent background; its lower part fades out so the road emerges from the dark instead of ending in a hard edge |
| `icon.svg`, `adaptive-foreground.svg` | Build inputs for the iOS and Android icons |

The wordmark ("Drive" in white plus "Sense" in orange) is live Nunito Black text in the app, not an asset.

Road geometry:
- The road is a filled shape. It is wide at the bottom edge of the tile and narrows to a near-point
  on the horizon in the upper third, with a gentle S-bend.
- The centre line is a row of dark dashes along the road's midline. Dash length and width shrink
  toward the horizon to give perspective. `centreDashes(phase)` in
  `src/brand/logo.ts` generates them: it samples the midline Bézier, places dashes
  at perspective-scaled intervals shifted by `phase` (0–1, one dash period), and returns one path
  string. The static SVGs and the icon use `phase = 0`; the intro animates `phase`.
- A faint horizon line (accent at 25 % opacity) crosses the tile at the vanishing point.

`scripts/build-brand-assets.sh` renders the PNGs with `rsvg-convert` and overwrites the current
placeholders:

| Output | Source | Notes |
|---|---|---|
| `assets/icon.png` 1024² | `logo-tile.svg` | Full bleed with square corners; iOS applies its own mask |
| `assets/adaptive-icon.png` 1024² | `logo-mark.svg` | Road inside the central 66 % safe zone; background colour set in `app.json` |
| `assets/splash-icon.png` 1024² | `logo-mark.svg` | Transparent background |
| `assets/favicon.png` 48² | `logo-tile.svg` | |

The PNGs are committed alongside the SVGs, so a build does not need `rsvg-convert`.

## 2. Native splash (every launch)

`app.json`, plugin `expo-splash-screen`:
- `image`: `./assets/splash-icon.png`, `imageWidth`: 200
- `backgroundColor` `#000000` in light **and** dark mode. The splash is always dark, so the intro,
  which is also dark, starts on an identical frame.
- `android.adaptiveIcon.backgroundColor` stays `#000000`.

Expo Go keeps its own icon and loading screen. The new icon and splash show only in a
development build (`npx expo run:ios`) or an EAS build. The animated intro works in Expo Go.

## 3. Animated intro (first launch only)

`src/components/brand/BrandIntro.tsx`, a full-screen overlay (`position: absolute`, black) drawn
by the root layout above the `Stack`.

- **Hand-off:** the road mark is drawn at the same size (200 pt wide) and centre as the native
  splash image, so hiding the splash shows no jump.
- **Timeline:**
  - 0–800 ms: the centre-line dashes travel toward the horizon. `phase` runs from 0 to 2 (two
    dash periods). An `Animated.Value` listener re-renders the dash path from
    `centreDashes(phase % 1)`.
  - 550–1000 ms: the mark eases up by 56 pt, and the wordmark fades in from 12 pt below, under
    the mark.
  - 1500–1800 ms: the overlay fades out, revealing sign-in (or tabs, if a session already exists).
- **Skip:** tapping anywhere jumps straight to the fade-out.
- **Reduce Motion** (`AccessibilityInfo.isReduceMotionEnabled`): no movement. The mark and the
  wordmark show at rest for 600 ms, then fade out.
- **Implementation:** RN `Animated` and `react-native-svg`. No new dependency. The `opacity`
  and `translateY` animations use the native driver; `phase` runs on the JS driver.
- `scripts/build-brand-assets.sh` builds the SVG masters from the same `src/brand/logo.ts`, through
  `node scripts/write-brand-svgs.mjs` (Node 25 strips the TypeScript types itself, so no `tsx`
  is needed; `src/brand/logo.ts` therefore uses only erasable syntax and no imports), so the icon and the in-app logo cannot drift apart.
- `onDone()` is called once, after the fade-out; the root layout then unmounts the overlay.

## 4. First-launch gate

`src/stores/brandIntroStore.ts` (Zustand):
- `hydrated`, `seen`, `hydrate()`, `markSeen()`.
- AsyncStorage key `brand_intro_seen_v1` = `'1'`.
- The root layout adds `hydrate()` to its startup effect and waits for `hydrated` before hiding
  the splash, as it already does for the other stores.
- When `seen` is false, the root layout renders `<BrandIntro onDone={markSeen} />` over the stack.
  `markSeen()` writes the flag and sets `seen` in memory, which unmounts the overlay.
- If storage fails, the intro shows again next launch. That is harmless.
- Reinstalling the app clears the flag and shows the intro again.

## 5. Logo in sign-in and sign-up

`AuthForm` header: a 56 pt `RoadLogo` tile above the existing "Welcome / Back" title.
`src/components/brand/RoadLogo.tsx` renders the tile from SVG paths shared with the intro
(`src/brand/logo.ts`), so the shapes have a single source.

## 6. Testing

- `logo` tests: `centreDashes(0)` and `centreDashes(1)` return the same path, which shows
  the loop is seamless; dashes get shorter toward the horizon.
- `brandIntroStore` tests: unseen by default; `hydrate` reads `'1'` as seen; `markSeen` persists.
- `introTimeline` tests: the full intro ends by 1.8 s and loops a whole number of dash periods; the Reduce Motion version has no movement.
- Simulator: the first launch plays the intro, a relaunch skips it, and Reduce Motion gives the
  static variant. Check the sign-in header.
- `npx tsc --noEmit`, `npx expo lint`, Jest.

## Out of scope

- iOS 26 dark and tinted icon variants (Icon Composer `.icon`).
- An animated native splash (Lottie or a native module).
- Marketing assets such as the App Store screenshots.
