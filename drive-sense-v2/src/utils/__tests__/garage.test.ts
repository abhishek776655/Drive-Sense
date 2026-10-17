import type {Vehicle} from '../../services/vehicleService';
import {draftFromVehicle, emptyDraft, inputFromDraft, vehiclePills} from '../garage';

const vehicle = (overrides: Partial<Vehicle> = {}): Vehicle => ({
  id: 'v1',
  company_name: 'Skoda',
  model_name: 'Citigo',
  image_url: null,
  nickname: null,
  display_name: 'Skoda Citigo',
  plate_number: null,
  fuel_type: 'petrol',
  vehicle_type: 'car',
  year: 2024,
  horsepower: 60,
  photo_url: null,
  ...overrides,
});

describe('vehiclePills', () => {
  it('lists horsepower, year and fuel', () => {
    expect(vehiclePills(vehicle())).toEqual(['60 HP', '2024', 'Petrol']);
  });

  it('keeps all three tags, with a dash for what is not known', () => {
    expect(vehiclePills(vehicle({horsepower: null, year: null, fuel_type: 'other'}))).toEqual(['– HP', 'Year –', 'Fuel –']);
  });
});

describe('inputFromDraft', () => {
  it('trims text, parses numbers and blanks the optional fields', () => {
    const draft = {...emptyDraft(), make: ' Skoda ', model: 'Citigo ', nickname: '  ', year: '2024', horsepower: '0'};
    expect(inputFromDraft(draft)).toEqual({
      input: {vehicle_type: 'car', nickname: null, make: 'Skoda', model: 'Citigo', year: 2024, horsepower: null, fuel_type: 'petrol'},
    });
  });

  it('needs make and model', () => {
    expect(inputFromDraft({...emptyDraft(), make: 'Skoda'})).toEqual({error: 'Enter the make and model.'});
  });

  it('rejects an impossible year', () => {
    expect(inputFromDraft({...emptyDraft(), make: 'A', model: 'B', year: '20'})).toEqual({error: 'Enter a year between 1900 and 2100.'});
  });

  it('round-trips an existing vehicle', () => {
    const result = inputFromDraft(draftFromVehicle(vehicle({nickname: 'Black Beauty'})));
    expect(result).toEqual({
      input: {vehicle_type: 'car', nickname: 'Black Beauty', make: 'Skoda', model: 'Citigo', year: 2024, horsepower: 60, fuel_type: 'petrol'},
    });
  });
});
