import type {GaugeStyle} from '../../stores/driveSettingsStore';

/** The Drive speedometer's styles in picker order, with their names (Customize sheet and swiping the dial). */
export const GAUGE_STYLE_OPTIONS: {id: GaugeStyle; label: string}[] = [
  {id: 'arc', label: 'Arc'},
  {id: 'tape', label: 'HUD'},
  {id: 'neon', label: 'Neon'},
  {id: 'classic', label: 'Classic'},
  {id: 'sport', label: 'Sport Car'},
  {id: 'luxury', label: 'Luxury'},
  {id: 'vintage', label: 'Vintage'},
  {id: 'rally', label: 'Rally'},
  {id: 'truck', label: 'Truck'},
  {id: 'motorcycle', label: 'Motorcycle'},
  {id: 'f1', label: 'F1'},
  {id: 'buggy', label: 'RC Buggy'},
  {id: 'kart', label: 'Go-Kart'},
  {id: 'atv', label: 'ATV'},
  {id: 'scooter', label: 'Scooter'},
  {id: 'moped', label: 'Moped'},
  {id: 'openRoad', label: 'Open Road'},
  {id: 'daylightRoad', label: 'Daylight Road'},
  {id: 'sunsetRoad', label: 'Sunset Road'},
];
