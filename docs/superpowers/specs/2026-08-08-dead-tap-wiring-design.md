# Dead-Tap Wiring — Design

**Date:** 2026-08-08
**Status:** Approved for planning

## Context

A codebase survey (deferred from the 2026-08-06 "surface unused telemetry" spec) found several buttons/icons across the mobile app whose `onPress` is empty, missing, or purely decorative. This spec wires every one of them to a real destination or action. Three of them (Notifications, Geofencing, Reports & Export) have no backend/data model behind them at all — building those "for real" is each its own future subsystem, so this batch gives them a "Coming soon" placeholder instead of leaving them dead.

Out of scope (separate future specs): the actual Notifications subsystem (data model, push delivery), Geofencing (new concept end to end), Reports & Export / trip sharing (deferred subsystem from the previous spec), driver achievements/streaks, idle-time insights, weekly speed-band aggregate.

## Items covered

1. Notification bell (`DashboardScreen.tsx`) → Coming soon
2. Settings icon (`ProfileScreen.tsx` header) → Settings screen
3. Profile menu items (rendered in both `ProfileOverviewSidebar.tsx` — used inside the sidebar drawer and Profile's wide layout — and duplicated inline in `ProfileScreen.tsx`'s narrow-layout `renderAccountMenu`):
   - My Vehicles → Garage tab
   - Trips History → Trips tab
   - Reports & Export → Coming soon
   - Geofencing → Coming soon
   - Alerts & Notifications → Coming soon (same destination as the bell)
   - Settings → Settings screen
   - Help & Support → Help & Support screen
   - About Drive Sense → About screen
4. "Add New Vehicle" button inside `VehicleSelector.tsx` → Garage tab's Add Vehicle screen
5. Share icon (`TripDetailsScreen.native.tsx` / `.web.tsx`) → native share sheet, no navigation

## Architecture

No new navigator. `ProfileStack` (currently just `ProfileMain`) gains four screens: `Settings`, `HelpSupport`, `About`, `ComingSoon`.

`AppSidebarProvider` is already mounted inside `NavigationContainer` (`navigation/AppNavigator.tsx`), so `AppSidebar.tsx` can call `useNavigation<BottomTabNavigationProp<MainTabsParamList>>()` directly — no navigation ref needed.

A single pure function, `resolveProfileMenuRoute(label: string): ProfileMenuDestination`, lives in `components/profileOverviewData.ts` next to `PROFILE_MENU_ITEMS` and returns either `{tab: keyof MainTabsParamList, screen: string}` or `{comingSoon: string}` (the title to show on the placeholder). Both call sites (`ProfileOverviewSidebar`'s menu list and `ProfileScreen`'s `renderAccountMenu`) resolve a label through this function and then call their own locally-typed `navigation.navigate(...)` — keeping the routing table in one place without forcing `ProfileOverviewSidebar` (a presentational component) to import navigation types itself.

`ProfileOverviewSidebar` gains an optional `onMenuItemPress?: (item: ProfileMenuItem) => void` prop; each menu row's `onPress` calls it. `AppSidebar.tsx` passes a handler that closes the drawer first, then resolves and navigates. `ProfileScreen.tsx`'s own `renderAccountMenu` wires the same resolver directly (it already has a `navigation` prop, no drawer to close).

`VehicleSelector.tsx` gains an optional `onAddVehicle?: () => void` prop (kept presentational — no navigation import). `DashboardScreen.tsx` wires it to close the selector sheet and navigate to `VehiclesStack`/`AddVehicle`.

## Navigation additions

`navigation/types.ts`:
```ts
export type ProfileStackParamList = {
  ProfileMain: undefined;
  Settings: undefined;
  HelpSupport: undefined;
  About: undefined;
  ComingSoon: {title: string; message?: string};
};
```
Plus `SettingsScreenProps`, `HelpSupportScreenProps`, `AboutScreenProps`, `ComingSoonScreenProps` following the existing `NativeStackScreenProps<ProfileStackParamList, '...'>` pattern (no bottom-tab composite needed — these screens don't need to navigate to other tabs themselves).

`navigation/ProfileStack.tsx` registers the four new `Stack.Screen` entries alongside `ProfileMain`.

## Screens

- **SettingsScreen** — the Dark Mode toggle (`Switch` + `theme.mode`/`toggleThemeMode`), moved out of `ProfileScreen`'s inline `renderAppearance()` into this screen. `ProfileScreen` replaces that inline block with a tappable "Settings" row (icon + label + chevron, matching the existing account-menu row style) that navigates here. This is the only real, already-backed preference in the app today — no new toggles are invented just to fill space.
- **HelpSupportScreen** — a static list of FAQ entries (hardcoded content, e.g. "How is my driving score calculated?", "Why did a trip not start automatically?", referencing the real thresholds from `CLAUDE.md`) plus a "Contact support" row that opens `Linking.openURL('mailto:support@drivesense.app')`.
- **AboutScreen** — app name, version string read by importing `app.json` directly (`import appConfig from '../../app.json'`, then `appConfig.expo.version` — Metro supports JSON imports, and this avoids adding `expo-constants` as a new direct dependency; it's currently only a transitive dependency nested under `expo`'s own `node_modules`, not resolvable from app code), and a short one-line tagline.
- **ComingSoonScreen** — takes `{title, message?}` route params, renders an icon + title + message ("We're still building this — check back soon." as the default) + a back button. Reused for all three not-yet-built destinations.

## Data flow

No backend changes. Everything here is client-side navigation or a native OS integration (`Share.share`, `Linking.openURL`). No new services, no new API calls.

## Error handling

- `Linking.openURL` and `Share.share` both reject if no handler is available (e.g. no mail client configured, share sheet cancelled) — wrap both in try/catch and no-op on failure (cancelling a share sheet is not an error state; a missing mail client is rare enough not to need a custom fallback UI for a "Contact support" link).
- Navigating to a tab that's already active is a no-op in react-navigation — no special handling needed.

## Testing

- `resolveProfileMenuRoute`: unit test every label in `PROFILE_MENU_ITEMS` maps to the expected destination, plus an unknown-label case (should not crash — returns a safe default, e.g. `{comingSoon: label}`).
- `ComingSoonScreen`: renders the given title/message; renders the default message when `message` is omitted.
- `SettingsScreen`: dark-mode toggle reflects and updates theme state (reuse the existing `useThemeMode` test double if one exists, otherwise mock it the same way `ProfileScreen` tests would).
- Everything else (cross-tab navigation calls, `Share.share`, `Linking.openURL`) is spot-checked manually — consistent with how the rest of this codebase treats navigation/OS-integration code (no existing tests cover `navigation.navigate` calls elsewhere either).
