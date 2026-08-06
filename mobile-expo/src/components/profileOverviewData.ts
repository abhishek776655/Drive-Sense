import type {ProfileMenuItem} from './ProfileOverviewSidebar';

export const PROFILE_USER = {
  initial: 'D',
  name: 'Demo User',
  email: 'demo@drivesense.com',
  statusLabel: 'Connected',
};

export const PROFILE_STATS = [
  {value: '3', label: 'Vehicles'},
  {value: '156', label: 'Trips'},
  {value: '2.4k', label: 'km Driven'},
];

export const ACTIVE_VEHICLE = {
  title: 'My Car',
  name: 'Honda City',
  plate: 'DL 10 AB 1234',
};

export const PROFILE_MENU_ITEMS: ProfileMenuItem[] = [
  {icon: 'car-outline', label: 'My Vehicles'},
  {icon: 'time-outline', label: 'Trips History'},
  {icon: 'document-text-outline', label: 'Reports & Export'},
  {icon: 'location-outline', label: 'Geofencing'},
  {icon: 'notifications-outline', label: 'Alerts & Notifications'},
  {icon: 'settings-outline', label: 'Settings'},
  {icon: 'help-circle-outline', label: 'Help & Support'},
  {icon: 'information-circle-outline', label: 'About Drive Sense'},
];

export const PROFILE_OVERVIEW_DATA = {
  user: PROFILE_USER,
  stats: PROFILE_STATS,
  activeVehicle: ACTIVE_VEHICLE,
  menuItems: PROFILE_MENU_ITEMS,
};
