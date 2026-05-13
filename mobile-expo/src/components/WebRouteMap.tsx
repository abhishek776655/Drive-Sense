import React, {useMemo} from 'react';
import {View} from 'react-native';
import {MapContainer, TileLayer, Polyline, CircleMarker, Popup, Marker} from 'react-leaflet';
import {divIcon} from 'leaflet';
import type {LatLngExpression} from 'leaflet';

type Point = {
  latitude: number;
  longitude: number;
};

type Props = {
  coordinates: Point[];
  startLabel: string;
  currentLabel: string;
  headingDeg?: number;
};

const getCenter = (coordinates: Point[]): [number, number] => {
  const lat = coordinates.reduce((sum, point) => sum + point.latitude, 0) / coordinates.length;
  const lng = coordinates.reduce((sum, point) => sum + point.longitude, 0) / coordinates.length;
  return [lat, lng];
};

export const WebRouteMap: React.FC<Props> = ({coordinates, startLabel, currentLabel, headingDeg = 0}) => {
  const positions: LatLngExpression[] = coordinates.map((point) => [point.latitude, point.longitude]);
  const center = getCenter(coordinates);
  const start = coordinates[0];
  const current = coordinates[coordinates.length - 1];
  const livePointerIcon = useMemo(
    () =>
      divIcon({
        className: '',
        html: `
          <div style="position: relative; width: 38px; height: 44px; display:flex; align-items:center; justify-content:center;">
            <div style="position:absolute; width:32px; height:32px; border-radius:999px; background:rgba(36,107,255,0.18);"></div>
            <div style="position:absolute; width:22px; height:22px; border-radius:999px; background:rgba(36,107,255,0.24); display:flex; align-items:center; justify-content:center; transform: rotate(${headingDeg}deg);">
              <div style="position:absolute; top:1px; width:0; height:0; border-left:6px solid transparent; border-right:6px solid transparent; border-bottom:11px solid #FFFFFF;"></div>
              <div style="width:12px; height:12px; border-radius:999px; background:#246BFF; border:2px solid #FFFFFF;"></div>
            </div>
            <div style="position:absolute; bottom:3px; width:14px; height:4px; border-radius:999px; background:rgba(15,23,42,0.18);"></div>
          </div>
        `,
        iconSize: [38, 44],
        iconAnchor: [19, 22],
      }),
    [headingDeg],
  );

  return (
    <View className="size-full overflow-hidden rounded-[inherit]">
      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom
        style={{width: '100%', height: '100%'}}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Polyline positions={positions} pathOptions={{color: '#246BFF', weight: 5, opacity: 0.95}} />
        <CircleMarker center={[start.latitude, start.longitude]} radius={7} pathOptions={{color: '#22C55E', fillColor: '#22C55E', fillOpacity: 1}}>
          <Popup>{startLabel}</Popup>
        </CircleMarker>
        <Marker position={[current.latitude, current.longitude]} icon={livePointerIcon}>
          <Popup>{currentLabel}</Popup>
        </Marker>
      </MapContainer>
    </View>
  );
};
