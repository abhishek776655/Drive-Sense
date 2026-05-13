import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import {CompositeScreenProps, NavigatorScreenParams} from '@react-navigation/native';

export type DashboardStackParamList = {
  DashboardMain: undefined;
};

export type TripsStackParamList = {
  TripsList: undefined;
  TripDetails: {tripId: string};
};

export type MapStackParamList = {
  LiveTrackingMain: undefined;
};

export type VehiclesStackParamList = {
  VehicleList: undefined;
  AddVehicle: {vehicleId?: string} | undefined;
  VehicleAnalytics: {vehicleId: string};
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
};

export type MainTabsParamList = {
  DashboardStack: NavigatorScreenParams<DashboardStackParamList>;
  TripsStack: NavigatorScreenParams<TripsStackParamList>;
  MapStack: NavigatorScreenParams<MapStackParamList>;
  VehiclesStack: NavigatorScreenParams<VehiclesStackParamList>;
  ProfileStack: NavigatorScreenParams<ProfileStackParamList>;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<MainTabsParamList>;
  Login: undefined;
};

export type DashboardScreenProps = CompositeScreenProps<
  NativeStackScreenProps<DashboardStackParamList, 'DashboardMain'>,
  BottomTabScreenProps<MainTabsParamList>
>;

export type TripsListScreenProps = CompositeScreenProps<
  NativeStackScreenProps<TripsStackParamList, 'TripsList'>,
  BottomTabScreenProps<MainTabsParamList>
>;

export type TripDetailsScreenProps = CompositeScreenProps<
  NativeStackScreenProps<TripsStackParamList, 'TripDetails'>,
  BottomTabScreenProps<MainTabsParamList>
>;

export type MapScreenProps = CompositeScreenProps<
  NativeStackScreenProps<MapStackParamList, 'LiveTrackingMain'>,
  BottomTabScreenProps<MainTabsParamList>
>;

export type VehicleListScreenProps = NativeStackScreenProps<VehiclesStackParamList, 'VehicleList'>;

export type AddVehicleScreenProps = NativeStackScreenProps<VehiclesStackParamList, 'AddVehicle'>;

export type VehicleAnalyticsScreenProps = NativeStackScreenProps<VehiclesStackParamList, 'VehicleAnalytics'>;

export type ProfileScreenProps = CompositeScreenProps<
  NativeStackScreenProps<ProfileStackParamList, 'ProfileMain'>,
  BottomTabScreenProps<MainTabsParamList>
>;
