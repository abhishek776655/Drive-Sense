# Profile Overview Sidebar Design

## Context

The DriveSense Expo app has a `ProfileScreen` under `ProfileStack`. The current profile screen is a single-column mobile-first layout with profile summary cards, an active vehicle card, an appearance section, account menu rows, and logout. The app also has a shared theme provider, so new UI must use `useAppTheme` and keep dark/light mode support.

## Goal

Add a permanent profile overview side panel for wider/web layouts while keeping mobile and narrow screens on the current single-column profile screen.

## Requirements

- Wide layouts render a persistent left sidebar for profile overview.
- Mobile and narrow layouts keep the existing profile screen layout.
- The sidebar must use existing DriveSense visual patterns: bordered cards, compact rows, Ionicons, and app theme colors.
- The sidebar must respect the current dark/light mode switcher.
- The implementation should avoid changes to global tab navigation.

## Proposed Architecture

Create a reusable `ProfileOverviewSidebar` component in `mobile-expo/src/components/ProfileOverviewSidebar.tsx`.

The component owns the profile overview presentation:

- User avatar, name, email, and connection status.
- Summary stats: vehicles, trips, and kilometers driven.
- Active vehicle summary.
- Account/menu links currently shown under `ACCOUNT`.

`ProfileScreen` will use `useWindowDimensions()` to choose layout:

- Narrow width: preserve the existing single-column `ScrollView` structure.
- Wide width, `900px` and above: render a horizontal layout with `ProfileOverviewSidebar` on the left and the remaining profile settings/actions content on the right.

The wide layout stays scoped inside `ProfileScreen`; it does not alter `MainTabs`, `ProfileStack`, or the app shell.

## Data Flow

The first implementation can use the existing static profile values already present in `ProfileScreen`: `Demo User`, `demo@drivesense.com`, vehicle counts, trip count, distance, and `Honda City`.

To keep the component easy to replace with real data later, `ProfileOverviewSidebar` should receive props for the user, stats, active vehicle, and menu items instead of hardcoding those values internally.

## Error Handling

This feature is mostly presentational. If any optional profile value is absent in future data, the component should render a reasonable fallback label rather than breaking layout.

## Testing

Run TypeScript compilation:

```bash
cd mobile-expo
npx tsc --noEmit
```

If Expo web starts successfully in the local environment, visually verify:

- Wide/web layout shows the permanent sidebar.
- Narrow/mobile layout remains single-column.
- Dark/light mode affects both the sidebar and main profile content.

## Non-Goals

- Do not add a slide-out drawer for mobile.
- Do not replace the bottom tab bar.
- Do not introduce new profile APIs or backend data fetching.
- Do not refactor unrelated profile navigation.
