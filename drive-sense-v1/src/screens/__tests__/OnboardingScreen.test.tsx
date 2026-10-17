import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {OnboardingScreen} from '../OnboardingScreen';
import {vehicleCatalogService} from '../../services/vehicleCatalogService';
import {vehicleService} from '../../services/vehicleService';

jest.mock('../../services/vehicleCatalogService', () => ({
  vehicleCatalogService: {fetchCatalog: jest.fn()},
}));
jest.mock('../../services/vehicleService', () => ({
  vehicleService: {createVehicle: jest.fn()},
}));
jest.mock('../../services/apiClient', () => ({
  getApiErrorMessage: (error: unknown, fallback = 'Something went wrong.') =>
    error instanceof Error ? error.message : fallback,
}));

const mockedCatalog = vehicleCatalogService.fetchCatalog as jest.MockedFunction<
  typeof vehicleCatalogService.fetchCatalog
>;
const mockedCreate = vehicleService.createVehicle as jest.MockedFunction<typeof vehicleService.createVehicle>;

const CATALOG = [
  {
    id: 'company-1',
    name: 'Honda',
    models: [
      {id: 'model-1', name: 'City', image_url: null},
      {id: 'model-2', name: 'Jazz', image_url: null},
    ],
  },
  {id: 'company-2', name: 'Tata', models: [{id: 'model-3', name: 'Nexon', image_url: null}]},
];

describe('OnboardingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedCatalog.mockResolvedValue(CATALOG);
  });

  const openModelStep = async () => {
    render(<OnboardingScreen onDone={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Honda')).toBeTruthy());
    fireEvent.press(screen.getByText('Honda'));
  };

  it('starts on the make step', async () => {
    render(<OnboardingScreen onDone={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Pick your make')).toBeTruthy());
    expect(screen.getByText('Honda')).toBeTruthy();
    expect(screen.getByText('Tata')).toBeTruthy();
  });

  it('shows only the chosen make’s models', async () => {
    await openModelStep();

    expect(screen.getByText('Pick your model')).toBeTruthy();
    expect(screen.getByText('City')).toBeTruthy();
    expect(screen.queryByText('Nexon')).toBeNull();
  });

  it('creates the vehicle with the selected model and fuel type', async () => {
    const onDone = jest.fn();
    mockedCreate.mockResolvedValue({} as never);
    render(<OnboardingScreen onDone={onDone} />);
    await waitFor(() => expect(screen.getByText('Honda')).toBeTruthy());

    fireEvent.press(screen.getByText('Honda'));
    fireEvent.press(screen.getByText('City'));
    fireEvent.changeText(screen.getByPlaceholderText('Nickname (optional)'), 'Daily driver');
    fireEvent.press(screen.getByLabelText('Add Vehicle'));

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(mockedCreate).toHaveBeenCalledWith({
      model_id: 'model-1',
      nickname: 'Daily driver',
      plate_number: null,
      fuel_type: 'petrol',
    });
  });

  it('sends null rather than empty strings for untouched optional fields', async () => {
    mockedCreate.mockResolvedValue({} as never);
    render(<OnboardingScreen onDone={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Honda')).toBeTruthy());

    fireEvent.press(screen.getByText('Honda'));
    fireEvent.press(screen.getByText('City'));
    fireEvent.press(screen.getByLabelText('Add Vehicle'));

    await waitFor(() => expect(mockedCreate).toHaveBeenCalled());
    expect(mockedCreate.mock.calls[0][0]).toMatchObject({nickname: null, plate_number: null});
  });

  it('keeps the user on the form when creation fails', async () => {
    const onDone = jest.fn();
    mockedCreate.mockRejectedValue(new Error('Vehicle limit reached'));
    render(<OnboardingScreen onDone={onDone} />);
    await waitFor(() => expect(screen.getByText('Honda')).toBeTruthy());

    fireEvent.press(screen.getByText('Honda'));
    fireEvent.press(screen.getByText('City'));
    fireEvent.press(screen.getByLabelText('Add Vehicle'));

    await waitFor(() => expect(screen.getByText('Vehicle limit reached')).toBeTruthy());
    expect(onDone).not.toHaveBeenCalled();
  });

  it('lets the user skip setup rather than trapping them at the door', async () => {
    const onDone = jest.fn();
    render(<OnboardingScreen onDone={onDone} />);
    await waitFor(() => expect(screen.getByText('Honda')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('Skip for now'));

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('can go back from models to makes', async () => {
    await openModelStep();

    fireEvent.press(screen.getByLabelText('Back'));

    expect(screen.getByText('Pick your make')).toBeTruthy();
  });

  it('reports a catalog that will not load', async () => {
    mockedCatalog.mockRejectedValue(new Error('Catalog unavailable'));
    render(<OnboardingScreen onDone={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Catalog unavailable')).toBeTruthy());
  });
});
