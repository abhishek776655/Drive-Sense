import {useEffect, useMemo} from 'react';
import {useDashboardStore} from '../store/dashboardStore';
import {useUserStore} from '../store/userStore';
import {useVehiclePreferencesStore} from '../store/vehiclePreferencesStore';
import {PROFILE_MENU_ITEMS} from './profileOverviewData';
import type {ProfileOverviewSidebarProps} from './ProfileOverviewSidebar';

const DASH = '—';

const formatCount = (value: number) => {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return String(value);
};

/**
 * Real profile overview data, replacing the hardcoded "Demo User / Honda City" fixtures.
 *
 * Everything except the account identity already lives in the dashboard and vehicle-preference
 * stores; only the email needs the auth endpoint. `UserRead` exposes no display name, so the email
 * is the identity line rather than an invented one.
 */
export const useProfileOverview = (): Omit<ProfileOverviewSidebarProps, 'onMenuItemPress' | 'style'> => {
  const dashboard = useDashboardStore((state) => state.data);
  const fetchDashboard = useDashboardStore((state) => state.fetchDashboard);
  const user = useUserStore((state) => state.user);
  const fetchCurrentUser = useUserStore((state) => state.fetchCurrentUser);
  const activeVehicleId = useVehiclePreferencesStore((state) => state.activeVehicleId);
  const hydrateVehiclePreferences = useVehiclePreferencesStore((state) => state.hydrate);

  useEffect(() => {
    void fetchCurrentUser();
  }, [fetchCurrentUser]);

  useEffect(() => {
    void hydrateVehiclePreferences();
  }, [hydrateVehiclePreferences]);

  useEffect(() => {
    if (!dashboard) {
      void fetchDashboard();
    }
  }, [dashboard, fetchDashboard]);

  const activeVehicle = useMemo(() => {
    const vehicles = dashboard?.vehicles ?? [];
    const resolved = vehicles.find((vehicle) => vehicle.id === activeVehicleId) ?? vehicles[0];

    if (!resolved) {
      return {title: 'Active vehicle', name: 'No vehicle yet', plate: 'Add one in the garage', imageUrl: null};
    }

    return {
      title: 'Active vehicle',
      name: resolved.name,
      plate: resolved.plateNumber ?? 'No plate added',
      imageUrl: resolved.imageUrl,
    };
  }, [activeVehicleId, dashboard?.vehicles]);

  const stats = useMemo(() => {
    if (!dashboard) {
      return [
        {value: DASH, label: 'Vehicles'},
        {value: DASH, label: 'Trips'},
        {value: DASH, label: 'km driven'},
      ];
    }

    return [
      {value: String(dashboard.vehicles.length), label: 'Vehicles'},
      {value: formatCount(dashboard.stats.totalTrips), label: 'Trips'},
      {value: formatCount(Math.round(dashboard.stats.totalDistance / 1000)), label: 'km driven'},
    ];
  }, [dashboard]);

  return useMemo(
    () => ({
      account: {
        initial: user?.email ? user.email.trim().charAt(0).toUpperCase() : '?',
        primary: user?.email ?? 'Signed in',
        secondary: user?.created_at
          ? `Member since ${new Date(user.created_at).toLocaleDateString('en-IN', {month: 'short', year: 'numeric'})}`
          : undefined,
      },
      stats,
      activeVehicle,
      menuItems: PROFILE_MENU_ITEMS,
    }),
    [activeVehicle, stats, user],
  );
};
