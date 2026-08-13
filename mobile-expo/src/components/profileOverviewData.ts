import type {ProfileMenuItem} from './ProfileOverviewSidebar';

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

export type ProfileMenuDestination =
  | {tab: 'DashboardStack' | 'TripsStack' | 'MapStack' | 'VehiclesStack' | 'ProfileStack'; screen: string}
  | {comingSoon: string};

const PROFILE_MENU_ROUTES: Record<string, ProfileMenuDestination> = {
  'My Vehicles': {tab: 'VehiclesStack', screen: 'VehicleList'},
  'Trips History': {tab: 'TripsStack', screen: 'TripsList'},
  'Reports & Export': {comingSoon: 'Reports & Export'},
  Geofencing: {comingSoon: 'Geofencing'},
  'Alerts & Notifications': {comingSoon: 'Notifications'},
  Settings: {tab: 'ProfileStack', screen: 'Settings'},
  'Help & Support': {tab: 'ProfileStack', screen: 'HelpSupport'},
  'About Drive Sense': {tab: 'ProfileStack', screen: 'About'},
};

export const resolveProfileMenuRoute = (label: string): ProfileMenuDestination =>
  PROFILE_MENU_ROUTES[label] ?? {comingSoon: label};
