import React from 'react';
import {Text, View} from 'react-native';
import {MapScreenProps} from '../navigation/types';
import {LiveTrackingLayout} from '../components/LiveTrackingLayout';
import {useMockLiveTracking} from '../hooks/useMockLiveTracking';
import {WebRouteMap} from '../components/WebRouteMap';
import {useDashboardStore} from '../store/dashboardStore';
import {useVehiclePreferencesStore} from '../store/vehiclePreferencesStore';

export const MapScreen: React.FC<MapScreenProps> = () => {
  const dashboard = useDashboardStore((state) => state.data);
  const activeVehicleId = useVehiclePreferencesStore((state) => state.activeVehicleId);
  const hydrateVehiclePreferences = useVehiclePreferencesStore((state) => state.hydrate);
  const liveVehicle = dashboard?.vehicles.find((vehicle) => vehicle.id === activeVehicleId) ?? dashboard?.vehicles[0];

  React.useEffect(() => {
    void hydrateVehiclePreferences();
  }, [hydrateVehiclePreferences]);
  const live = useMockLiveTracking({
    vehicleId: liveVehicle?.id,
    vehicleName: liveVehicle?.name,
  });
  const coordinates = live.location_points.map((point) => ({
    latitude: point.latitude,
    longitude: point.longitude,
  }));

  return (
    <LiveTrackingLayout
      data={live}
      mapContent={
        <View style={{flex: 1}}>
          <WebRouteMap
            coordinates={
              coordinates.length > 0
                ? coordinates
                : [{latitude: live.currentPoint.latitude, longitude: live.currentPoint.longitude}]
            }
            startLabel={`Trip Start ${live.start_time.slice(11, 19)}`}
            currentLabel={`Current Fix ${live.currentPoint.recorded_at.slice(11, 19)}`}
            headingDeg={live.currentPoint.heading_deg}
          />
        </View>
      }
    />
  );
};
