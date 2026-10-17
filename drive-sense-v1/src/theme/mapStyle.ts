import type {MapStyleElement} from 'react-native-maps';

/**
 * Dark map styling for the Google provider (Android).
 *
 * iOS uses Apple Maps, which ignores `customMapStyle` entirely — there the map follows
 * `userInterfaceStyle` instead. Both are applied at the call site so each platform gets the one it
 * honours.
 *
 * Tuned to sit under the app's dark surfaces: near-black land, slightly lifted roads so the route
 * polyline still separates from them, and muted labels so place names never compete with the puck.
 */
export const DARK_MAP_STYLE: MapStyleElement[] = [
  {elementType: 'geometry', stylers: [{color: '#0B1220'}]},
  {elementType: 'labels.text.fill', stylers: [{color: '#8A93A6'}]},
  {elementType: 'labels.text.stroke', stylers: [{color: '#0B1220'}]},
  {featureType: 'administrative', elementType: 'geometry', stylers: [{color: '#2A3550'}]},
  {featureType: 'administrative.land_parcel', stylers: [{visibility: 'off'}]},
  {featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{color: '#A8B0C2'}]},
  {featureType: 'poi', stylers: [{visibility: 'off'}]},
  {featureType: 'poi.park', elementType: 'geometry', stylers: [{color: '#14261C'}]},
  {featureType: 'road', elementType: 'geometry', stylers: [{color: '#1C2740'}]},
  {featureType: 'road', elementType: 'geometry.stroke', stylers: [{color: '#141D30'}]},
  {featureType: 'road', elementType: 'labels.text.fill', stylers: [{color: '#7C869B'}]},
  {featureType: 'road.arterial', elementType: 'geometry', stylers: [{color: '#222E4A'}]},
  {featureType: 'road.highway', elementType: 'geometry', stylers: [{color: '#2A3A5E'}]},
  {featureType: 'road.local', elementType: 'labels', stylers: [{visibility: 'off'}]},
  {featureType: 'transit', stylers: [{visibility: 'off'}]},
  {featureType: 'water', elementType: 'geometry', stylers: [{color: '#0A1A2C'}]},
  {featureType: 'water', elementType: 'labels.text.fill', stylers: [{color: '#3E5A78'}]},
];
