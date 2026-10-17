import {MaterialCommunityIcons} from '@expo/vector-icons';
import type {VehicleType} from '../../services/vehicleService';

/** Filled side-on glyph for the vehicle type, as on Rovy's Garage tiles. */
export function VehicleIcon({type, size, color}: {type: VehicleType; size: number; color: string}) {
  return <MaterialCommunityIcons name={type === 'motorbike' ? 'motorbike' : 'car-hatchback'} size={size} color={color} />;
}
