# Profile Overview Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable profile overview sidebar that appears as a permanent left panel on wide layouts while preserving the current mobile profile screen.

**Architecture:** Create `ProfileOverviewSidebar` as a focused presentational component that receives all display data through props and uses the shared app theme. Refactor `ProfileScreen` into small render helpers so the narrow layout keeps the existing single-column order and the wide layout composes the new sidebar with the remaining settings/actions content.

**Tech Stack:** React Native, Expo, TypeScript, NativeWind class names, Ionicons, existing `useAppTheme` and `useThemeMode` hooks.

---

### Task 1: Create `ProfileOverviewSidebar`

**Files:**
- Create: `mobile-expo/src/components/ProfileOverviewSidebar.tsx`

- [ ] **Step 1: Add the component API and layout**

Create `mobile-expo/src/components/ProfileOverviewSidebar.tsx` with these exported types:

```tsx
export type ProfileMenuItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
};

export type ProfileOverviewSidebarProps = {
  user: {
    initial: string;
    name: string;
    email: string;
    statusLabel: string;
  };
  stats: Array<{
    value: string;
    label: string;
  }>;
  activeVehicle: {
    title: string;
    name: string;
    plate: string;
  };
  menuItems: ProfileMenuItem[];
};
```

The component should render:

- Header card with avatar, user name, email, and connected status.
- Three stat columns.
- Active vehicle card.
- Account menu rows.

- [ ] **Step 2: Verify with TypeScript**

Run:

```bash
cd mobile-expo
npx tsc --noEmit
```

Expected: fail until `ProfileScreen` imports and uses the new component only if there are export/import mismatches. If the component is standalone and TypeScript passes, continue because the project has no frontend test runner configured in `package.json`.

### Task 2: Refactor `ProfileScreen` for Responsive Composition

**Files:**
- Modify: `mobile-expo/src/screens/ProfileScreen.tsx`
- Use: `mobile-expo/src/components/ProfileOverviewSidebar.tsx`

- [ ] **Step 1: Introduce shared profile constants**

Move the current inline static values into constants inside `ProfileScreen.tsx`:

```tsx
const PROFILE_USER = {
  initial: 'D',
  name: 'Demo User',
  email: 'demo@drivesense.com',
  statusLabel: 'Connected',
};

const PROFILE_STATS = [
  {value: '3', label: 'Vehicles'},
  {value: '156', label: 'Trips'},
  {value: '2.4k', label: 'km Driven'},
];

const ACTIVE_VEHICLE = {
  title: 'My Car',
  name: 'Honda City',
  plate: 'DL 10 AB 1234',
};
```

- [ ] **Step 2: Add responsive width detection**

Use `useWindowDimensions()` and compute:

```tsx
const {width} = useWindowDimensions();
const isWideLayout = width >= 900;
```

- [ ] **Step 3: Preserve narrow layout**

For `!isWideLayout`, render the current single-column layout with the same header, profile summary card, stats card, active vehicle card, appearance card, account menu, and logout button.

- [ ] **Step 4: Add wide layout**

For `isWideLayout`, render:

```tsx
<SafeAreaView className="flex-1" style={{backgroundColor: theme.screen}}>
  <View className="flex-1 flex-row px-6 pt-5" style={{gap: 18}}>
    <ProfileOverviewSidebar
      user={PROFILE_USER}
      stats={PROFILE_STATS}
      activeVehicle={ACTIVE_VEHICLE}
      menuItems={MENU_ITEMS}
    />
    <ScrollView
      className="flex-1"
      contentContainerStyle={{paddingBottom: 132}}
      showsVerticalScrollIndicator={false}>
      {/* header, appearance card, logout button */}
    </ScrollView>
  </View>
</SafeAreaView>
```

The wide main column should not duplicate the sidebar-owned profile summary, stats, active vehicle, or account menu.

- [ ] **Step 5: Verify with TypeScript**

Run:

```bash
cd mobile-expo
npx tsc --noEmit
```

Expected: pass.

### Task 3: Visual Verification

**Files:**
- No code changes unless verification exposes layout issues.

- [ ] **Step 1: Try Expo web**

Run:

```bash
cd mobile-expo
npm run web -- --port 8081
```

Expected: Expo starts and serves the app. If this environment repeats the known `ERR_SOCKET_BAD_PORT` failure, record that verification was blocked by the local Node/Expo runtime issue.

- [ ] **Step 2: Check layout behavior**

If Expo web starts, verify:

- Width `>= 900px`: sidebar is visible as a permanent left panel.
- Width `< 900px`: current single-column profile layout is visible.
- Toggling dark mode updates sidebar and main profile content.

- [ ] **Step 3: Final TypeScript check**

Run:

```bash
cd mobile-expo
npx tsc --noEmit
```

Expected: pass.
