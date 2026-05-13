import React, {useEffect} from 'react';
import {View} from 'react-native';
import {CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap} from 'react-leaflet';
import type {LatLngExpression} from 'leaflet';
import {buildRouteColorSections, type TimedRoutePoint} from '../utils/tripRoute';
import {useAppTheme} from '../theme/appTheme';

type Props = {
  routePoints: TimedRoutePoint[];
  startLabel: string;
  endLabel: string;
};

const FitRouteBounds: React.FC<{positions: [number, number][]}> = ({positions}) => {
  const map = useMap();

  useEffect(() => {
    if (positions.length > 0) {
      map.fitBounds(positions, {padding: [24, 24]});
    }
  }, [map, positions]);

  return null;
};

const getCenter = (points: TimedRoutePoint[]): [number, number] => {
  const latitude = points.reduce((sum, point) => sum + point.latitude, 0) / points.length;
  const longitude = points.reduce((sum, point) => sum + point.longitude, 0) / points.length;
  return [latitude, longitude];
};

export const RouteSpeedMap: React.FC<Props> = ({routePoints, startLabel, endLabel}) => {
  const theme = useAppTheme();
  if (!routePoints || routePoints.length < 2) {
    return <View style={{flex: 1, backgroundColor: theme.cardSoft}} />;
  }

  const sections = buildRouteColorSections(routePoints);
  const positions = routePoints.map((point) => [point.latitude, point.longitude] as [number, number]);
  const startPoint = routePoints[0];
  const endPoint = routePoints[routePoints.length - 1];

  return (
    <MapContainer center={getCenter(routePoints)} zoom={12} scrollWheelZoom style={{width: '100%', height: '100%'}}>
      <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitRouteBounds positions={positions} />
      {sections.map((section, index) => (
        <Polyline
          key={`${section.band.key}-${index}`}
          positions={section.coordinates.map((point) => [point.latitude, point.longitude] as LatLngExpression)}
          pathOptions={{color: section.band.color, weight: 5, opacity: 0.95}}
        />
      ))}
      <CircleMarker center={[startPoint.latitude, startPoint.longitude]} radius={7} pathOptions={{color: '#22C55E', fillColor: '#22C55E', fillOpacity: 1}}>
        <Popup>{startLabel}</Popup>
      </CircleMarker>
      <CircleMarker center={[endPoint.latitude, endPoint.longitude]} radius={7} pathOptions={{color: '#0F172A', fillColor: '#2563EB', fillOpacity: 1}}>
        <Popup>{endLabel}</Popup>
      </CircleMarker>
    </MapContainer>
  );
};
