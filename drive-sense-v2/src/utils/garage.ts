import {DASH} from './format';
import type {FuelType, Vehicle, VehicleInput, VehicleType} from '../services/vehicleService';

/** The fuels the Add sheet offers, in Rovy's order (LPG and "other" stay readable, not pickable). */
export const FUEL_OPTIONS: {value: FuelType; label: string}[] = [
  {value: 'petrol', label: 'Petrol'},
  {value: 'diesel', label: 'Diesel'},
  {value: 'electric', label: 'Electric'},
  {value: 'hybrid', label: 'Hybrid'},
  {value: 'cng', label: 'CNG'},
];

const FUEL_LABELS: Record<FuelType, string> = {
  petrol: 'Petrol',
  diesel: 'Diesel',
  electric: 'Electric',
  hybrid: 'Hybrid',
  cng: 'CNG',
  lpg: 'LPG',
  other: 'Other',
};

export const vehicleNoun = (type: VehicleType) => (type === 'motorbike' ? 'Motorbike' : 'Car');

/** The three grey tags under the vehicle name: engine power, year and fuel; a dash when not known. */
export const vehiclePills = (vehicle: Vehicle): string[] => [
  vehicle.horsepower != null ? `${vehicle.horsepower} HP` : `${DASH} HP`,
  vehicle.year != null ? String(vehicle.year) : `Year ${DASH}`,
  vehicle.fuel_type !== 'other' ? FUEL_LABELS[vehicle.fuel_type] : `Fuel ${DASH}`,
];

/** The sheet edits text; numbers are parsed on save. */
export interface VehicleDraft {
  vehicle_type: VehicleType;
  nickname: string;
  make: string;
  model: string;
  year: string;
  horsepower: string;
  fuel_type: FuelType;
}

export const emptyDraft = (): VehicleDraft => ({
  vehicle_type: 'car',
  nickname: '',
  make: '',
  model: '',
  year: String(new Date().getFullYear()),
  horsepower: '',
  fuel_type: 'petrol',
});

export const draftFromVehicle = (vehicle: Vehicle): VehicleDraft => ({
  vehicle_type: vehicle.vehicle_type,
  nickname: vehicle.nickname ?? '',
  make: vehicle.company_name,
  model: vehicle.model_name,
  year: vehicle.year != null ? String(vehicle.year) : '',
  horsepower: vehicle.horsepower != null ? String(vehicle.horsepower) : '',
  fuel_type: vehicle.fuel_type,
});

const wholeNumber = (text: string): number | null => {
  const n = Number.parseInt(text.trim(), 10);
  return Number.isFinite(n) ? n : null;
};

/** The request body, or a message saying what to fix. */
export const inputFromDraft = (draft: VehicleDraft): {input: VehicleInput} | {error: string} => {
  const make = draft.make.trim();
  const model = draft.model.trim();
  if (!make || !model) {
    return {error: 'Enter the make and model.'};
  }
  const year = draft.year.trim() ? wholeNumber(draft.year) : null;
  if (draft.year.trim() && (year == null || year < 1900 || year > 2100)) {
    return {error: 'Enter a year between 1900 and 2100.'};
  }
  const horsepower = draft.horsepower.trim() ? wholeNumber(draft.horsepower) : null;
  // A blank or zero HP means "not known" (Rovy shows "0 HP"; we leave the pill out instead).
  if (draft.horsepower.trim() && (horsepower == null || horsepower < 0 || horsepower > 5000)) {
    return {error: 'Enter horsepower as a number.'};
  }
  return {
    input: {
      vehicle_type: draft.vehicle_type,
      nickname: draft.nickname.trim() || null,
      make,
      model,
      year,
      horsepower: horsepower ? horsepower : null,
      fuel_type: draft.fuel_type,
    },
  };
};
