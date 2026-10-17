# Brand Logo and First-Launch Intro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Expo's placeholder icon and splash with the DriveSense horizon-road logo, and play a short animated brand intro the first time the app opens.

**Architecture:** One import-free geometry module, `src/brand/logo.ts`, defines the road, the lane dashes and the brand colours. The app draws from it with `react-native-svg` (`RoadLogo`), and a Node script turns the same module into SVGs and PNGs for the icon and the splash. A small Zustand store gates the intro on an AsyncStorage flag, and the root layout draws `BrandIntro` over the stack until the intro is marked seen.

**Tech Stack:** Expo SDK 57, React Native `Animated`, `react-native-svg` 15, Zustand, AsyncStorage, Jest (`jest-expo`), Node 25 (runs `.ts` natively), `rsvg-convert`.

Spec: `docs/superpowers/specs/2026-10-17-mobile-v2-brand-logo-design.md`

## Global Constraints

- All app paths are relative to `drive-sense-v2/`. Run commands from there.
- **Do not commit.** The user commits. Each task ends with a check, not a commit.
- No raw colour literals (`'#…'`, `rgba(…)`) in `src/components/**` or `src/app/**`; the test `src/components/__tests__/tokenContract.test.ts` enforces this. Brand colours live in `src/brand/logo.ts`.
- `src/brand/logo.ts` must have **no imports** and use only erasable TypeScript syntax (no enums, namespaces or parameter properties), so plain `node` can load it.
- Colours: ink `#000000` (equal to `DARK_PALETTE.canvas`), road `#FF6D00` (equal to `ORANGE_ACCENT.base`), paper `#FFFFFF`.
- The native splash `imageWidth` is **200**, and the intro draws the mark at **200** pt, so the hand-off doesn't jump.
- Intro: about 1.8 s in total; tap to skip; Reduce Motion means no movement. First launch only, using AsyncStorage key `brand_intro_seen_v1` = `'1'`.
- Add no new npm dependencies.
- Before calling a task done, run `npx tsc --noEmit` and `npx expo lint`.

---

### Task 1: Logo geometry module

**Files:**
- Create: `src/brand/logo.ts`
- Test: `src/brand/__tests__/logo.test.ts`

**Interfaces:**
- Produces:
  - `LOGO_SIZE = 1024`, `TILE_RADIUS = 230`, `FADE_TOP_Y = 800`
  - `HORIZON: {y: number; x1: number; x2: number; width: number; opacity: number}`
  - `BRAND_INK = '#000000'`, `BRAND_ROAD = '#FF6D00'`, `BRAND_PAPER = '#FFFFFF'`
  - `roadPath(): string`: the filled road outline, in the 1024 viewBox
  - `centreDashes(phase: number): string`: every lane dash as one path; `phase` in [0, 1] slides them one period toward the horizon, and `centreDashes(0) === centreDashes(1)`

- [x] **Step 1: Write the failing test**

`src/brand/__tests__/logo.test.ts`:

```ts
import {DARK_PALETTE, ORANGE_ACCENT} from '../../theme/palettes';
import {BRAND_INK, BRAND_ROAD, centreDashes, LOGO_SIZE, roadPath} from '../logo';

/** Bounding box of each `M…Z` sub-path. */
const boxes = (d: string) =>
  d
    .split('M')
    .filter(Boolean)
    .map((part) => {
      const nums = part.replace('Z', '').split('L').map((pair) => pair.trim().split(' ').map(Number));
      const xs = nums.map(([x]) => x);
      const ys = nums.map(([, y]) => y);
      return {w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), top: Math.min(...ys)};
    });

describe('logo geometry', () => {
  it('uses the app canvas and accent', () => {
    expect(BRAND_INK).toBe(DARK_PALETTE.canvas);
    expect(BRAND_ROAD).toBe(ORANGE_ACCENT.base);
  });

  it('keeps the road inside the tile', () => {
    const [road] = boxes(roadPath());
    expect(road.top).toBeGreaterThan(0);
    expect(road.top + road.h).toBeLessThanOrEqual(LOGO_SIZE + 0.1);
  });

  it('loops seamlessly: a whole dash period later the dashes are where they started', () => {
    expect(centreDashes(1)).toBe(centreDashes(0));
    expect(centreDashes(0.5)).not.toBe(centreDashes(0));
  });

  it('draws dashes smaller toward the horizon', () => {
    const dashes = boxes(centreDashes(0));
    expect(dashes.length).toBeGreaterThanOrEqual(5);
    // Ordered near to far: each sits higher up and is shorter than the one before.
    for (let i = 1; i < dashes.length; i++) {
      expect(dashes[i].top).toBeLessThan(dashes[i - 1].top);
      expect(dashes[i].h).toBeLessThan(dashes[i - 1].h);
    }
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/brand/__tests__/logo.test.ts`
Expected: FAIL with "Cannot find module '../logo'".

- [x] **Step 3: Write the implementation**

`src/brand/logo.ts`:

```ts
/**
 * DriveSense logo geometry: an orange road tapering to the horizon (spec 2026-10-17, brand logo).
 * Import-free and plain TypeScript so `scripts/write-brand-svgs.mjs` can run it under Node to build
 * the icon and splash PNGs: the app logo and the store icon share one source.
 */

export const LOGO_SIZE = 1024;
/** Rounded-square tile used in the app; the iOS icon is full bleed and masked by the OS. */
export const TILE_RADIUS = 230;
/** The splash mark fades the road in from the bottom edge up to this line. */
export const FADE_TOP_Y = 800;
export const HORIZON = {y: 330, x1: 140, x2: 884, width: 6, opacity: 0.35};

export const BRAND_INK = '#000000';
export const BRAND_ROAD = '#FF6D00';
export const BRAND_PAPER = '#FFFFFF';

type Point = {x: number; y: number};

/** Road midline: leaves the bottom edge straight up, bends right, then settles onto the horizon. */
const MID: Point[] = [
  {x: 512, y: 1024},
  {x: 512, y: 760},
  {x: 640, y: 560},
  {x: 560, y: HORIZON.y},
];
const NEAR_HALF_WIDTH = 240;
const FAR_HALF_WIDTH = 3;
/** World depth at the bottom edge and at the horizon, in dash periods. */
const NEAR_DEPTH = 2;
const FAR_DEPTH = 20;
/** Share of a period that is painted, and a dash's half-width as a share of the road's. */
const DASH_LENGTH = 0.45;
const DASH_WIDTH = 0.055;
/** Dashes thinner than this (logo units) vanish at icon sizes, so they are not drawn. */
const MIN_DASH_HALF_WIDTH = 1.5;

const bezier = (t: number): Point => {
  const u = 1 - t;
  const [a, b, c, d] = MID;
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
  };
};

const tangent = (t: number): Point => {
  const u = 1 - t;
  const [a, b, c, d] = MID;
  return {
    x: 3 * u * u * (b.x - a.x) + 6 * u * t * (c.x - b.x) + 3 * t * t * (d.x - c.x),
    y: 3 * u * u * (b.y - a.y) + 6 * u * t * (c.y - b.y) + 3 * t * t * (d.y - c.y),
  };
};

const halfWidthAt = (t: number): number => NEAR_HALF_WIDTH + (FAR_HALF_WIDTH - NEAR_HALF_WIDTH) * t;

/** A point `scale` road-half-widths left (side 1) or right (side -1) of the midline. */
const edge = (t: number, side: number, scale: number): Point => {
  const m = bezier(t);
  const d = tangent(t);
  const len = Math.hypot(d.x, d.y);
  const w = halfWidthAt(t) * scale * side;
  return {x: m.x - (d.y / len) * w, y: m.y + (d.x / len) * w};
};

// One decimal keeps paths short; `+ 0` turns -0 into 0 so equal shapes print equal strings.
const fmt = (n: number): string => String(Math.round(n * 10) / 10 + 0);

/** Closed band along the midline from t0 to t1, `scale` road-half-widths wide on each side. */
const band = (t0: number, t1: number, steps: number, scale: number): string => {
  const left: Point[] = [];
  const right: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = t0 + ((t1 - t0) * i) / steps;
    left.push(edge(t, 1, scale));
    right.push(edge(t, -1, scale));
  }
  return 'M' + [...left, ...right.reverse()].map((p) => `${fmt(p.x)} ${fmt(p.y)}`).join('L') + 'Z';
};

export const roadPath = (): string => band(0, 1, 64, 1);

/** Perspective: equal steps in depth land closer together on screen as they near the horizon. */
const depthToT = (z: number): number => (1 / NEAR_DEPTH - 1 / z) / (1 / NEAR_DEPTH - 1 / FAR_DEPTH);

export const centreDashes = (phase: number): string => {
  const parts: string[] = [];
  // k = -1 supplies the dash that slides in from the bottom edge as phase grows.
  for (let k = -1; k < FAR_DEPTH - NEAR_DEPTH; k++) {
    const start = NEAR_DEPTH + k + phase;
    const from = Math.max(start, NEAR_DEPTH);
    const to = Math.min(start + DASH_LENGTH, FAR_DEPTH);
    if (to <= from) {
      continue;
    }
    const t0 = depthToT(from);
    const t1 = depthToT(to);
    if (halfWidthAt(t1) * DASH_WIDTH < MIN_DASH_HALF_WIDTH) {
      continue;
    }
    parts.push(band(t0, t1, 6, DASH_WIDTH));
  }
  return parts.join('');
};
```

- [x] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/brand/__tests__/logo.test.ts`
Expected: PASS, 4 tests.

- [x] **Step 5: Check that plain Node loads the module**

Run: `node -e "import('./src/brand/logo.ts').then(m => console.log(m.centreDashes(0) === m.centreDashes(1)))"`
Expected: prints `true`. A `MODULE_TYPELESS_PACKAGE_JSON` warning is acceptable.

---

### Task 2: Icon, splash and favicon assets

**Files:**
- Create: `scripts/write-brand-svgs.mjs`
- Create: `scripts/build-brand-assets.sh`
- Create (generated): `assets/brand/logo-tile.svg`, `assets/brand/logo-mark.svg`, `assets/brand/icon.svg`, `assets/brand/adaptive-foreground.svg`
- Overwrite (generated): `assets/icon.png`, `assets/adaptive-icon.png`, `assets/splash-icon.png`, `assets/favicon.png`
- Modify: `app.json` (the `expo-splash-screen` plugin entry)

**Interfaces:**
- Consumes: from `src/brand/logo.ts`: `LOGO_SIZE`, `TILE_RADIUS`, `FADE_TOP_Y`, `HORIZON`, `BRAND_INK`, `BRAND_ROAD`, `roadPath`, `centreDashes`.
- Produces: the PNG files that `app.json` already references.

- [x] **Step 1: Write the SVG generator**

`scripts/write-brand-svgs.mjs`:

```js
// Writes the DriveSense logo SVGs from src/brand/logo.ts (spec 2026-10-17, brand logo).
// Node 25 loads the .ts module directly; build-brand-assets.sh renders these to PNG.
import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {BRAND_INK, BRAND_ROAD, centreDashes, FADE_TOP_Y, HORIZON, LOGO_SIZE, roadPath, TILE_RADIUS} from '../src/brand/logo.ts';

const S = LOGO_SIZE;
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'brand');

const fade = `<defs><linearGradient id="roadFade" x1="0" y1="${S}" x2="0" y2="${FADE_TOP_Y}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${BRAND_ROAD}" stop-opacity="0"/><stop offset="1" stop-color="${BRAND_ROAD}"/></linearGradient></defs>`;
const art = (roadFill) =>
  `<line x1="${HORIZON.x1}" x2="${HORIZON.x2}" y1="${HORIZON.y}" y2="${HORIZON.y}" stroke="${BRAND_ROAD}" stroke-opacity="${HORIZON.opacity}" stroke-width="${HORIZON.width}" stroke-linecap="round"/>` +
  `<path d="${roadPath()}" fill="${roadFill}"/>` +
  `<path d="${centreDashes(0)}" fill="${BRAND_INK}"/>`;
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">${body}</svg>\n`;
// Android crops adaptive icons to the central 66 %; keep the road inside it.
const inset = (S * (1 - 0.66)) / 2;

const files = {
  'logo-tile.svg': svg(`<rect width="${S}" height="${S}" rx="${TILE_RADIUS}" fill="${BRAND_INK}"/>${art(BRAND_ROAD)}`),
  'icon.svg': svg(`<rect width="${S}" height="${S}" fill="${BRAND_INK}"/>${art(BRAND_ROAD)}`),
  'logo-mark.svg': svg(`${fade}${art('url(#roadFade)')}`),
  'adaptive-foreground.svg': svg(`${fade}<g transform="translate(${inset} ${inset}) scale(0.66)">${art('url(#roadFade)')}</g>`),
};

mkdirSync(out, {recursive: true});
for (const [name, content] of Object.entries(files)) {
  writeFileSync(join(out, name), content);
}
console.log(`wrote ${Object.keys(files).length} SVGs to assets/brand`);
```

- [x] **Step 2: Write the PNG build script**

`scripts/build-brand-assets.sh`:

```bash
#!/usr/bin/env bash
# Renders the DriveSense logo PNGs from src/brand/logo.ts (spec 2026-10-17, brand logo).
# Re-run after changing the logo geometry; the PNGs are committed, so builds don't need this.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v rsvg-convert >/dev/null; then
  echo "rsvg-convert not found: brew install librsvg" >&2
  exit 1
fi

node scripts/write-brand-svgs.mjs
# -b paints an opaque background: the App Store rejects icons with an alpha channel.
rsvg-convert -w 1024 -h 1024 -b '#000000' assets/brand/icon.svg -o assets/icon.png
rsvg-convert -w 1024 -h 1024 assets/brand/adaptive-foreground.svg -o assets/adaptive-icon.png
rsvg-convert -w 1024 -h 1024 assets/brand/logo-mark.svg -o assets/splash-icon.png
rsvg-convert -w 48 -h 48 assets/brand/logo-tile.svg -o assets/favicon.png
echo "brand PNGs updated"
```

- [x] **Step 3: Run it**

Run: `chmod +x scripts/build-brand-assets.sh && ./scripts/build-brand-assets.sh`
Expected: `wrote 4 SVGs to assets/brand`, then `brand PNGs updated`.

- [x] **Step 4: Check the outputs**

Run: `sips -g pixelWidth -g hasAlpha assets/icon.png assets/splash-icon.png assets/favicon.png`
Expected:
- `icon.png`: 1024, `hasAlpha: no`
- `splash-icon.png`: 1024, `hasAlpha: yes`
- `favicon.png`: 48

Open `assets/icon.png` and `assets/splash-icon.png` with the Read tool and check that:
- the road reaches the horizon line
- the dashes shrink toward the horizon
- the splash road fades in from the bottom

- [x] **Step 5: Point the splash at the dark logo in both modes**

In `app.json`, replace the `expo-splash-screen` plugin entry with:

```json
      [
        "expo-splash-screen",
        {
          "image": "./assets/splash-icon.png",
          "imageWidth": 200,
          "resizeMode": "contain",
          "backgroundColor": "#000000",
          "dark": {
            "image": "./assets/splash-icon.png",
            "backgroundColor": "#000000"
          }
        }
      ],
```

`android.adaptiveIcon.backgroundColor` is already `#000000`; leave it.

- [x] **Step 6: Validate the config**

Run: `npx expo config --type public | grep -A8 expo-splash-screen`
Expected: shows `imageWidth: 200` and `backgroundColor: '#000000'`.

---

### Task 3: First-launch gate store

**Files:**
- Create: `src/stores/brandIntroStore.ts`
- Test: `src/stores/__tests__/brandIntroStore.test.ts`

**Interfaces:**
- Produces: `useBrandIntroStore`, holding `{hydrated: boolean; seen: boolean; hydrate(): Promise<void>; markSeen(): void}`.

- [x] **Step 1: Write the failing test**

`src/stores/__tests__/brandIntroStore.test.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useBrandIntroStore} from '../brandIntroStore';

beforeEach(() => {
  useBrandIntroStore.setState({hydrated: false, seen: false});
});

describe('brand intro gate', () => {
  it('plays on a fresh install', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    await useBrandIntroStore.getState().hydrate();
    expect(useBrandIntroStore.getState()).toMatchObject({hydrated: true, seen: false});
  });

  it('is skipped once it has played', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('1');
    await useBrandIntroStore.getState().hydrate();
    expect(useBrandIntroStore.getState()).toMatchObject({hydrated: true, seen: true});
  });

  it('still lets the app start when storage fails', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('disk'));
    await useBrandIntroStore.getState().hydrate();
    expect(useBrandIntroStore.getState()).toMatchObject({hydrated: true, seen: false});
  });

  it('remembers that it played', () => {
    useBrandIntroStore.getState().markSeen();
    expect(useBrandIntroStore.getState().seen).toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('brand_intro_seen_v1', '1');
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/stores/__tests__/brandIntroStore.test.ts`
Expected: FAIL with "Cannot find module '../brandIntroStore'".

- [x] **Step 3: Write the implementation**

`src/stores/brandIntroStore.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import {create} from 'zustand';

const KEY = 'brand_intro_seen_v1';

interface BrandIntroState {
  hydrated: boolean;
  /** True once the first-launch brand intro has played (or was skipped). */
  seen: boolean;
  hydrate: () => Promise<void>;
  markSeen: () => void;
}

/** Gates the animated brand intro to the very first launch (spec 2026-10-17, brand logo). */
export const useBrandIntroStore = create<BrandIntroState>((set) => ({
  hydrated: false,
  seen: false,
  hydrate: async () => {
    try {
      set({seen: (await AsyncStorage.getItem(KEY)) === '1', hydrated: true});
    } catch {
      // Unreadable storage only means the intro plays again; never block start-up on it.
      set({hydrated: true});
    }
  },
  markSeen: () => {
    set({seen: true});
    AsyncStorage.setItem(KEY, '1').catch(() => undefined);
  },
}));
```

- [x] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/stores/__tests__/brandIntroStore.test.ts`
Expected: PASS, 4 tests.

---

### Task 4: `RoadLogo` component and the sign-in header

**Files:**
- Create: `src/components/brand/RoadLogo.tsx`
- Modify: `src/components/AuthForm.tsx` (imports, and the header `<View style={{marginBottom: 12}}>` at about line 103)

**Interfaces:**
- Consumes: from `src/brand/logo.ts`: `LOGO_SIZE`, `TILE_RADIUS`, `FADE_TOP_Y`, `HORIZON`, `BRAND_INK`, `BRAND_ROAD`, `roadPath`, `centreDashes`.
- Produces: `RoadLogo({size: number; variant: 'tile' | 'mark'; phase?: number})`.

- [x] **Step 1: Write the component**

`src/components/brand/RoadLogo.tsx`:

```tsx
import Svg, {Defs, Line, LinearGradient, Path, Rect, Stop} from 'react-native-svg';
import {BRAND_INK, BRAND_ROAD, centreDashes, FADE_TOP_Y, HORIZON, LOGO_SIZE, roadPath, TILE_RADIUS} from '../../brand/logo';

const ROAD = roadPath();
const DASHES_AT_REST = centreDashes(0);

/**
 * The DriveSense road. `tile` is the app-icon look (black rounded square); `mark` is the road on its
 * own, fading in from the bottom like the splash. `phase` (0–1) slides the lane dashes toward the
 * horizon, which is how the intro makes the road move.
 */
export function RoadLogo({size, variant, phase = 0}: {size: number; variant: 'tile' | 'mark'; phase?: number}) {
  const tile = variant === 'tile';
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${LOGO_SIZE} ${LOGO_SIZE}`} accessibilityLabel="DriveSense">
      {tile ? (
        <Rect width={LOGO_SIZE} height={LOGO_SIZE} rx={TILE_RADIUS} fill={BRAND_INK} />
      ) : (
        <Defs>
          <LinearGradient id="roadFade" x1={0} y1={LOGO_SIZE} x2={0} y2={FADE_TOP_Y} gradientUnits="userSpaceOnUse">
            <Stop offset={0} stopColor={BRAND_ROAD} stopOpacity={0} />
            <Stop offset={1} stopColor={BRAND_ROAD} stopOpacity={1} />
          </LinearGradient>
        </Defs>
      )}
      <Line
        x1={HORIZON.x1}
        x2={HORIZON.x2}
        y1={HORIZON.y}
        y2={HORIZON.y}
        stroke={BRAND_ROAD}
        strokeOpacity={HORIZON.opacity}
        strokeWidth={HORIZON.width}
        strokeLinecap="round"
      />
      <Path d={ROAD} fill={tile ? BRAND_ROAD : 'url(#roadFade)'} />
      <Path d={phase === 0 ? DASHES_AT_REST : centreDashes(phase)} fill={BRAND_INK} />
    </Svg>
  );
}
```

- [x] **Step 2: Put the tile above the sign-in title**

In `src/components/AuthForm.tsx`, add the import beside the other component imports:

```tsx
import {RoadLogo} from './brand/RoadLogo';
```

Replace the header block:

```tsx
        <View style={{marginBottom: 12}}>
          <AppText size={30} weight="extrabold" tone="secondary">
```

with:

```tsx
        <View style={{marginBottom: 12}}>
          <View style={{marginBottom: 18}}>
            <RoadLogo variant="tile" size={56} />
          </View>
          <AppText size={30} weight="extrabold" tone="secondary">
```

- [x] **Step 3: Check the token contract, types and lint**

Run: `npm test -- src/components/__tests__/tokenContract.test.ts && npx tsc --noEmit && npx expo lint`
Expected: all pass. `'url(#roadFade)'` doesn't match the raw-colour pattern, because the pattern needs `#` straight after the quote.

---

### Task 5: Intro timeline, `BrandIntro` and root layout wiring

**Files:**
- Create: `src/brand/introTimeline.ts`
- Test: `src/brand/__tests__/introTimeline.test.ts`
- Create: `src/components/brand/BrandIntro.tsx`
- Modify: `src/app/_layout.tsx` (`RootLayout`)

**Interfaces:**
- Consumes:
  - `RoadLogo` (Task 4)
  - `useBrandIntroStore` (Task 3)
  - `BRAND_INK`, `BRAND_PAPER`, `BRAND_ROAD` (Task 1)
  - `AppText` from `src/components/AppText.tsx`, with props `size`, `weight`, `color`
- Produces:
  - `introTimeline(reduceMotion: boolean): IntroTimeline`
  - `RISE_PT = 56`
  - `BrandIntro({onDone}: {onDone: () => void})`

- [x] **Step 1: Write the failing timeline test**

`src/brand/__tests__/introTimeline.test.ts`:

```ts
import {introTimeline} from '../introTimeline';

describe('intro timeline', () => {
  it('finishes within 1.8 s, after the road and the wordmark have settled', () => {
    const t = introTimeline(false);
    expect(t.holdMs + t.fadeMs).toBeLessThanOrEqual(1800);
    expect(t.driveMs).toBeLessThanOrEqual(t.holdMs);
    expect(t.riseDelayMs + t.riseMs).toBeLessThanOrEqual(t.holdMs);
  });

  it('drives a whole number of dash periods, so the road comes to rest as drawn on the icon', () => {
    expect(Number.isInteger(introTimeline(false).dashPeriods)).toBe(true);
    expect(introTimeline(false).dashPeriods).toBeGreaterThan(0);
  });

  it('does not move with Reduce Motion on', () => {
    const t = introTimeline(true);
    expect(t).toMatchObject({dashPeriods: 0, driveMs: 0, riseMs: 0});
    expect(t.holdMs + t.fadeMs).toBeLessThanOrEqual(1000);
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/brand/__tests__/introTimeline.test.ts`
Expected: FAIL with "Cannot find module '../introTimeline'".

- [x] **Step 3: Write the timeline**

`src/brand/introTimeline.ts`:

```ts
/** How far the road mark rises to make room for the wordmark, in points. */
export const RISE_PT = 56;

export interface IntroTimeline {
  /** Lane-dash periods the road scrolls through; whole, so it stops exactly as on the icon. */
  dashPeriods: number;
  driveMs: number;
  riseDelayMs: number;
  riseMs: number;
  /** From start until the overlay begins to fade out. */
  holdMs: number;
  fadeMs: number;
}

/** First-launch brand intro timing (spec 2026-10-17, brand logo, section 3). */
export const introTimeline = (reduceMotion: boolean): IntroTimeline =>
  reduceMotion
    ? {dashPeriods: 0, driveMs: 0, riseDelayMs: 0, riseMs: 0, holdMs: 600, fadeMs: 200}
    : {dashPeriods: 2, driveMs: 800, riseDelayMs: 550, riseMs: 450, holdMs: 1500, fadeMs: 300};
```

- [x] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/brand/__tests__/introTimeline.test.ts`
Expected: PASS, 3 tests.

- [x] **Step 5: Write `BrandIntro`**

`src/components/brand/BrandIntro.tsx`:

```tsx
import {StatusBar} from 'expo-status-bar';
import {useEffect, useState} from 'react';
import {AccessibilityInfo, Animated, Easing, Pressable, StyleSheet} from 'react-native';
import {BRAND_INK, BRAND_PAPER, BRAND_ROAD} from '../../brand/logo';
import {introTimeline, RISE_PT} from '../../brand/introTimeline';
import {AppText} from '../AppText';
import {RoadLogo} from './RoadLogo';

/** Same as `imageWidth` of the native splash in app.json, so the hand-off from it does not jump. */
const MARK_SIZE = 200;
const WORDMARK_GAP = 12;

/**
 * First-launch brand intro, drawn over the app: the splash's road starts moving (lane dashes run to
 * the horizon), rises, and the wordmark fades in under it; then the overlay fades away. A tap skips
 * to the fade. With Reduce Motion on nothing moves; the logo holds briefly and fades.
 */
export function BrandIntro({onDone}: {onDone: () => void}) {
  const [phase, setPhase] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [fadeMs, setFadeMs] = useState(300);
  const [drive] = useState(() => new Animated.Value(0));
  const [rise] = useState(() => new Animated.Value(0));
  const [fade] = useState(() => new Animated.Value(1));

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // The dash path is SVG data, not a style, so it re-renders from the JS-driven value.
    const id = drive.addListener(({value}) => setPhase(value % 1));
    void AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) {
          return;
        }
        const t = introTimeline(reduce);
        setFadeMs(t.fadeMs);
        Animated.parallel([
          Animated.timing(drive, {toValue: t.dashPeriods, duration: t.driveMs, easing: Easing.out(Easing.quad), useNativeDriver: false}),
          Animated.timing(rise, {toValue: 1, delay: t.riseDelayMs, duration: t.riseMs, easing: Easing.out(Easing.cubic), useNativeDriver: true}),
        ]).start();
        timer = setTimeout(() => setLeaving(true), t.holdMs);
      });
    return () => {
      cancelled = true;
      drive.removeListener(id);
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [drive, rise]);

  useEffect(() => {
    if (leaving) {
      Animated.timing(fade, {toValue: 0, duration: fadeMs, useNativeDriver: true}).start(() => onDone());
    }
  }, [leaving, fade, fadeMs, onDone]);

  return (
    <Animated.View pointerEvents={leaving ? 'none' : 'auto'} style={[StyleSheet.absoluteFill, {backgroundColor: BRAND_INK, opacity: fade}]}>
      <StatusBar style="light" />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Skip intro"
        onPress={() => setLeaving(true)}
        style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
        <Animated.View style={{transform: [{translateY: rise.interpolate({inputRange: [0, 1], outputRange: [0, -RISE_PT]})}]}}>
          <RoadLogo variant="mark" size={MARK_SIZE} phase={phase} />
        </Animated.View>
        <Animated.View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '50%',
            marginTop: MARK_SIZE / 2 - RISE_PT + WORDMARK_GAP,
            flexDirection: 'row',
            justifyContent: 'center',
            opacity: rise,
            transform: [{translateY: rise.interpolate({inputRange: [0, 1], outputRange: [WORDMARK_GAP, 0]})}],
          }}>
          <AppText size={34} weight="black" color={BRAND_PAPER}>
            Drive
          </AppText>
          <AppText size={34} weight="black" color={BRAND_ROAD}>
            Sense
          </AppText>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}
```

- [x] **Step 6: Wire it into the root layout**

In `src/app/_layout.tsx`:

Add the imports:

```tsx
import {BrandIntro} from '../components/brand/BrandIntro';
import {useBrandIntroStore} from '../stores/brandIntroStore';
```

In `RootLayout`, after the `const [recordingHydrated, …]` line, add:

```tsx
  const introHydrated = useBrandIntroStore((s) => s.hydrated);
  const introSeen = useBrandIntroStore((s) => s.seen);
  const hydrateIntro = useBrandIntroStore((s) => s.hydrate);
  const markIntroSeen = useBrandIntroStore((s) => s.markSeen);
```

In the start-up effect, add `void hydrateIntro();` after `void hydratePreferences();`, and add `hydrateIntro` to its dependency array:

```tsx
  }, [bootstrap, hydrateAppearance, hydrateDriveSettings, hydratePreferences, hydrateIntro]);
```

Change `ready` to also wait for the gate:

```tsx
  const ready = fontsLoaded && appearanceHydrated && preferencesHydrated && recordingHydrated && introHydrated && authStatus !== 'checking';
```

Change the final return to draw the intro over the stack until it has played:

```tsx
  return (
    <ThemeProvider>
      <RootStack />
      {/* First launch only: the splash hands off to the animated brand intro. */}
      {introSeen ? null : <BrandIntro onDone={markIntroSeen} />}
    </ThemeProvider>
  );
```

- [x] **Step 7: Run the full check**

Run: `npx tsc --noEmit && npx expo lint && npm test`
Expected: everything passes. The test count is the previous 382 plus 11 new tests.

---

### Task 6: Verify on the simulator

**Files:** none changed, unless a defect turns up.

- [ ] **Step 1: Force a first launch**

The simulator UDID is `D60A8A8B-272A-4F0F-AB7C-145024A50154`, and Expo runs on port 8082. The current install has never set `brand_intro_seen_v1`, so the first reload after Task 5 is already a first launch.

To replay the intro later, add a temporary line to the start-up effect in `_layout.tsx`, reload once, then delete the line:

```tsx
void AsyncStorage.removeItem('brand_intro_seen_v1');
```

- [ ] **Step 2: Watch the intro**

Reload the app (`exp://127.0.0.1:8082`). Take simulator screenshots at about 0.3 s, 1.0 s and 2.0 s after the splash, and check:
- the road's dashes move
- the road rises, and "DriveSense" appears under it
- the overlay fades to sign-in (or to Home if already signed in)

- [ ] **Step 3: Relaunch**

Reload again and confirm the intro doesn't play.

- [ ] **Step 4: Sign-in header**

Sign out (Settings, Sign out), or open the login route, and screenshot. The 56 pt black tile with the orange road should sit above "Welcome / Back", in both light and dark appearance.

- [ ] **Step 5: Native icon and splash (dev build only)**

Expo Go shows its own icon and splash. To check ours, run `npx expo run:ios` once the user agrees, since it creates the native `ios/` project. Then check:
- the home-screen icon
- the black splash with the road at 200 pt

Then confirm that the intro starts in exactly the same place.
