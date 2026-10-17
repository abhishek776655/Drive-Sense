import React from 'react';
import {View} from 'react-native';
import MapView, {Marker, Polyline} from 'react-native-maps';
import {buildRouteColorSections, getRouteRegion, type TimedRoutePoint} from '../utils/tripRoute';
import {useAppTheme} from '../theme/appTheme';
import {DARK_MAP_STYLE} from '../theme/mapStyle';

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
  const routeKey = `${routePoints.length}-${startPoint.latitude}-${startPoint.longitude}-${endPoint.latitude}-${endPoint.longitude}`;

  return (
    <MapView
      key={routeKey}
      style={{flex: 1}}
      initialRegion={region}
      userInterfaceStyle={theme.dark ? 'dark' : 'light'}
      customMapStyle={theme.dark ? DARK_MAP_STYLE : undefined}
      scrollEnabled
      rotateEnabled={false}
      pitchEnabled={false}>
      <Polyline
        coordinates={routePoints}
        strokeColor={theme.dark ? 'rgba(255,255,255,0.36)' : 'rgba(15,23,42,0.24)'}
        strokeWidth={8}
        zIndex={1}
      />
      {sections.map((section, index) => (
        <Polyline
          key={`${section.band.key}-${index}`}
          coordinates={section.coordinates}
          strokeColor={section.band.color}
          strokeWidth={6}
          zIndex={2}
        />
      ))}
      <Marker coordinate={startPoint} title="Start" description={startLabel} pinColor="#4E9B74" />
      <Marker coordinate={endPoint} title="End" description={endLabel} pinColor="#0F172A" />
    </MapView>
  );
};
