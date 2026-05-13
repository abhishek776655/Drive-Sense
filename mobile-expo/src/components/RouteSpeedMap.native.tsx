import React from 'react';
import {View} from 'react-native';
import MapView, {Marker, Polyline} from 'react-native-maps';
import {buildRouteColorSections, getRouteRegion, type TimedRoutePoint} from '../utils/tripRoute';
import {useAppTheme} from '../theme/appTheme';

type Props = {
  routePoints: TimedRoutePoint[];
  startLabel: string;
  endLabel: string;
};

export const RouteSpeedMap: React.FC<Props> = ({routePoints, startLabel, endLabel}) => {
  const theme = useAppTheme();
  if (!routePoints || routePoints.length < 2) {
    return <View style={{flex: 1, backgroundColor: theme.cardSoft}} />;
  }

  const sections = buildRouteColorSections(routePoints);
  const region = getRouteRegion(routePoints);
  const startPoint = routePoints[0];
  const endPoint = routePoints[routePoints.length - 1];

  return (
    <MapView style={{flex: 1}} initialRegion={region} scrollEnabled rotateEnabled={false} pitchEnabled={false}>
      {sections.map((section, index) => (
        <Polyline
          key={`${section.band.key}-${index}`}
          coordinates={section.coordinates}
          strokeColor={section.band.color}
          strokeWidth={5}
        />
      ))}
      <Marker coordinate={startPoint} title="Start" description={startLabel} pinColor="#22C55E" />
      <Marker coordinate={endPoint} title="End" description={endLabel} pinColor="#0F172A" />
    </MapView>
  );
};
