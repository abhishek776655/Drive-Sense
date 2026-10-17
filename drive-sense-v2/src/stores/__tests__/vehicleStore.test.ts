import {vehicleService, type Vehicle, type VehicleInput} from '../../services/vehicleService';
import {useVehicleStore} from '../vehicleStore';

jest.mock('../../services/vehicleService', () => ({
  vehicleService: {list: jest.fn(), create: jest.fn(), update: jest.fn(), remove: jest.fn(), stats: jest.fn(), uploadPhoto: jest.fn(), removePhoto: jest.fn()},
}));

const service = vehicleService as jest.Mocked<typeof vehicleService>;

const vehicle = (id: string, overrides: Partial<Vehicle> = {}): Vehicle => ({
  id,
  company_name: 'Skoda',
  model_name: 'Citigo',
  image_url: null,
  nickname: null,
  display_name: 'Skoda Citigo',
  plate_number: null,
  fuel_type: 'petrol',
  vehicle_type: 'car',
  year: 2024,
  horsepower: null,
  photo_url: null,
  ...overrides,
});

const input: VehicleInput = {vehicle_type: 'motorbike', nickname: null, make: 'Royal Enfield', model: 'Hunter', year: 2023, horsepower: 20, fuel_type: 'petrol'};

describe('vehicleStore', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    useVehicleStore.setState({vehicles: [vehicle('a'), vehicle('b')], activeVehicleId: 'a', stats: {}, loading: false, error: null});
  });

  it('adds a vehicle and makes it active', async () => {
    service.create.mockResolvedValueOnce(vehicle('c', {vehicle_type: 'motorbike'}));
    await useVehicleStore.getState().create(input);
    expect(useVehicleStore.getState().vehicles.map((v) => v.id)).toEqual(['a', 'b', 'c']);
    expect(useVehicleStore.getState().activeVehicleId).toBe('c');
  });

  it('replaces an edited vehicle in place', async () => {
    service.update.mockResolvedValueOnce(vehicle('b', {model_name: 'Fabia'}));
    await useVehicleStore.getState().update('b', input);
    expect(useVehicleStore.getState().vehicles[1].model_name).toBe('Fabia');
  });

  it('moves the active vehicle on when the active one is deleted', async () => {
    service.remove.mockResolvedValueOnce(undefined);
    await useVehicleStore.getState().remove('a');
    expect(useVehicleStore.getState().vehicles.map((v) => v.id)).toEqual(['b']);
    expect(useVehicleStore.getState().activeVehicleId).toBe('b');
  });

  it('surfaces a readable error and keeps the list when a save fails', async () => {
    service.create.mockRejectedValueOnce(new Error('boom'));
    await expect(useVehicleStore.getState().create(input)).rejects.toThrow();
    expect(useVehicleStore.getState().vehicles).toHaveLength(2);
  });

  it('swaps in the vehicle returned by a photo upload or removal', async () => {
    service.uploadPhoto.mockResolvedValueOnce(vehicle('a', {photo_url: '/p?v=1'}));
    await useVehicleStore.getState().setPhoto('a', 'abc');
    expect(service.uploadPhoto).toHaveBeenCalledWith('a', 'abc');
    expect(useVehicleStore.getState().vehicles[0].photo_url).toBe('/p?v=1');
    service.removePhoto.mockResolvedValueOnce(vehicle('a'));
    await useVehicleStore.getState().setPhoto('a', null);
    expect(useVehicleStore.getState().vehicles[0].photo_url).toBeNull();
  });

  it('caches stats per vehicle and ignores failures', async () => {
    service.stats.mockResolvedValueOnce({trip_count: 4} as never);
    await useVehicleStore.getState().loadStats('a');
    service.stats.mockRejectedValueOnce(new Error('down'));
    await useVehicleStore.getState().loadStats('b');
    expect(useVehicleStore.getState().stats).toEqual({a: {trip_count: 4}});
  });
});
