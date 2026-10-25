# Cluster mode (Twin layout) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A full-screen landscape digital cluster opened from Telemetry, with the Mercedes-inspired "Twin" layout, swipeable centre pages (Trip, Engine, Car, Map) and premium motion.

**Architecture:** A root-stack route (`src/app/cluster.tsx`) in landscape holds the chrome and a layout registry. Layouts read one plain data object (`useClusterData`). Drawing is Skia on the GPU; motion is Reanimated shared values on the UI thread, so adapter readings never re-render the tree. Pure maths lives in `src/cluster/motion.ts` and is unit-tested.

**Tech Stack:** Expo SDK 57, React Native 0.86, Expo Router (native stack), `@shopify/react-native-skia`, `react-native-reanimated` 4, `react-native-gesture-handler` 3, `expo-keep-awake`, Jest.

Spec: `docs/superpowers/specs/2026-10-25-mobile-v2-cluster-design.md`

## Global Constraints

- Inspired by Mercedes' twin-dial cluster; no Mercedes logos, marks, typefaces or artwork. Layout name in the app: "Twin".
- Always dark; accent from `clusterAccent` (orange, blue, teal, red, purple), default the Drive speedometer accent.
- Landscape only on the cluster route; every other route portrait.
- Phone-only mode without an adapter: GPS speed, G dial instead of RPM, Engine and Car pages hidden.
- Reduce Motion: keep value smoothing; drop sweep, trails, pulses, particles, rolling digits.
- Run `npx tsc --noEmit`, `npx expo lint`, `npx jest` before declaring done.

## File map

| File | Responsibility |
|---|---|
| `src/cluster/motion.ts` | Pure maths: value→angle, arc paths, tick lit state, trail, redline intensity, particle speed, coasting, G from speed/heading. |
| `src/cluster/useClusterData.ts` | The data object from existing stores and hooks. |
| `src/cluster/layouts.ts` | Layout registry `{id, name, Component}`. |
| `src/cluster/accents.ts` | Accent palette. |
| `src/cluster/parts/ArcDial.tsx` | Skia dial: ticks, glow arc, trail, redline, rolling number. |
| `src/cluster/parts/GDial.tsx` | Skia G-force dial. |
| `src/cluster/parts/BarGauge.tsx` | Small horizontal bar gauge. |
| `src/cluster/parts/LoadMeter.tsx` | Engine page: load arc, throttle arc, particles, coasting, load trace. |
| `src/cluster/parts/CentrePager.tsx` | Gesture pager with depth (scale, fade, blur). |
| `src/cluster/parts/pages.tsx` | Trip, Car, Map page contents. |
| `src/cluster/twin/TwinLayout.tsx` | The Twin layout. |
| `src/app/cluster.tsx` | Route: orientation, full screen, keep-awake, chrome, switcher. |

## Tasks

1. **Dependencies.** `npx expo install @shopify/react-native-skia react-native-reanimated react-native-gesture-handler react-native-worklets expo-keep-awake`; `app.json` `orientation: "default"`; root stack screens `orientation: 'portrait'`, cluster `'landscape'`.
2. **Motion maths (TDD).** `angleFor(value, max, sweep)`, `arcPath(cx, cy, r, from, to)`, `tickLit(tickValue, value)`, `redlineHeat(rpm, redline)`, `particleSpeed(loadPct)`, `isCoasting(throttle, minThrottle, speed)`, `gFrom(prev, next)`; tests.
3. **Data hook (TDD on the pure mapper).** `clusterData(stores, now)` pure + `useClusterData()` wrapper; tests for adapter vs phone-only and hidden fields.
4. **Skia parts.** `ArcDial`, `GDial`, `BarGauge`, `LoadMeter` take shared values; start-up sweep; Reduce Motion.
5. **Pager and layout.** `CentrePager` (pan gesture, spring, per-page scale/opacity/blur, haptic), pages, `TwinLayout`.
6. **Route and entry.** `src/app/cluster.tsx`, chrome (auto-hiding top row, accent dots, layout switcher), keep-awake, hidden status bar; preferences `clusterLayout`, `clusterAccent`; "Cluster" button on Telemetry.
7. **Build and check.** Prebuild iOS (restore `EXPO_USE_PRECOMPILED_MODULES: false`), `expo run:ios`, one screenshot in landscape; commit.
