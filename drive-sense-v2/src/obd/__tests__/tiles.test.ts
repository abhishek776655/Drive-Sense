import {economy, economyLabel, fuelVolume, gearLabel, obdTiles} from '../tiles';

const NONE = {fuelFlow: null, economy: null, boost: null, gear: null, torqueNm: null, powerKw: null, accelMps2: null};
const metric = {units: 'metric' as const, temperature: 'c' as const, engineRunning: true};

describe('OBD tiles', () => {
  it('shows only what the car reports', () => {
    expect(obdTiles({}, NONE, metric)).toEqual([]);
    const ids = obdTiles({coolant: {v: 90}, voltage: {v: 14.1}}, NONE, metric).map((t) => t.id);
    expect(ids).toEqual(['coolant', 'voltage']);
  });

  it('shows torque and power only when worked out, in the chosen units', () => {
    const d = {...NONE, torqueNm: 150, powerKw: 50};
    const tiles = obdTiles({}, d, metric);
    expect(tiles.find((t) => t.id === 'torque')).toMatchObject({value: '150', unit: 'Nm'});
    expect(tiles.find((t) => t.id === 'power')).toMatchObject({value: '50', unit: 'kW'});
    const imp = obdTiles({}, d, {...metric, units: 'imperial'});
    expect(imp.find((t) => t.id === 'torque')).toMatchObject({value: '111', unit: 'lb-ft'});
    expect(imp.find((t) => t.id === 'power')).toMatchObject({value: '67', unit: 'hp'});
    expect(obdTiles({}, NONE, metric).map((t) => t.id)).not.toContain('torque');
  });

  it('shows acceleration signed and the odometer in the chosen units', () => {
    const t = obdTiles({odometer: {v: 22120.8}}, {...NONE, accelMps2: -1.24}, metric);
    expect(t.find((x) => x.id === 'accel')).toMatchObject({value: '−1.2', unit: 'm/s²'});
    expect(t.find((x) => x.id === 'odometer')).toMatchObject({value: '22,120.8', unit: 'km'});
    const imp = obdTiles({odometer: {v: 22120.8}}, NONE, {...metric, units: 'imperial'});
    expect(imp.find((x) => x.id === 'odometer')).toMatchObject({value: '13,745.2', unit: 'mi'});
  });

  it('calls coolant Engine temp, and shows fuel as percent and litres when the tank size is known', () => {
    expect(obdTiles({coolant: {v: 82}}, NONE, metric)[0]).toMatchObject({id: 'coolant', label: 'Engine temp'});
    const withTank = obdTiles({fuelLevel: {v: 28.63}}, NONE, {...metric, tankLitres: 50}).find((t) => t.id === 'fuelLevel');
    expect(withTank).toMatchObject({label: 'Fuel remaining', value: '29', unit: '% · 14.3 L'});
    const gallons = obdTiles({fuelLevel: {v: 28.63}}, NONE, {...metric, units: 'imperial', tankLitres: 50}).find((t) => t.id === 'fuelLevel');
    expect(gallons?.unit).toBe('% · 3.8 gal');
    expect(obdTiles({fuelLevel: {v: 28.63}}, NONE, metric).find((t) => t.id === 'fuelLevel')?.unit).toBe('%');
  });

  it("shows today's mileage and fuel when known", () => {
    const t = obdTiles({}, NONE, {...metric, todayL100km: 6, todayFuelL: 1.5});
    expect(t.find((x) => x.id === 'todayEconomy')).toMatchObject({label: 'Economy today', value: '6.0', unit: 'L/100 km'});
    expect(t.find((x) => x.id === 'todayFuel')).toMatchObject({label: 'Fuel today', value: '1.50', unit: 'L'});
  });

  it('has no fuel flow tile: it only feeds mileage and fuel used', () => {
    expect(obdTiles({}, {...NONE, fuelFlow: 4}, metric).map((t) => t.id)).not.toContain('fuelFlow');
  });

  it('flags a hot engine and a battery not charging', () => {
    const [hot] = obdTiles({coolant: {v: 106}}, NONE, metric);
    expect(hot.tone).toBe('warn');
    const [boiling] = obdTiles({coolant: {v: 116}}, NONE, metric);
    expect(boiling.tone).toBe('alert');
    expect(obdTiles({voltage: {v: 12.6}}, NONE, metric)[0].tone).toBe('warn');
    expect(obdTiles({voltage: {v: 12.6}}, NONE, {...metric, engineRunning: false})[0].tone).toBe('normal');
  });

  it('uses the chosen units', () => {
    const [t] = obdTiles({coolant: {v: 100}}, NONE, {...metric, temperature: 'f'});
    expect(t).toMatchObject({value: '212', unit: '°F'});
    expect(economy(10, 'imperial')).toEqual({value: '23.5', unit: 'mpg'});
    expect(economy(6.5, 'metric')).toEqual({value: '6.5', unit: 'L/100 km'});
  });

  it('shows range after fuel level, warning below 50 km', () => {
    const tiles = obdTiles({fuelLevel: {v: 40}}, NONE, {...metric, rangeKm: 312.4});
    expect(tiles.map((t) => t.id)).toEqual(['fuelLevel', 'range']);
    expect(tiles[1]).toMatchObject({value: '≈312', unit: 'km', tone: 'normal'});
    expect(obdTiles({}, NONE, {...metric, rangeKm: 40})[0].tone).toBe('warn');
    expect(obdTiles({}, NONE, {...metric, units: 'imperial', rangeKm: 160.9344})[0]).toMatchObject({value: '≈100', unit: 'mi'});
  });

  it('shows mileage in km/L when chosen', () => {
    expect(economy(7.1, 'metric', 'kmpl')).toEqual({value: '14.1', unit: 'km/L'});
    expect(economy(7.1, 'imperial', 'kmpl').unit).toBe('mpg');
    expect(economyLabel('metric', 'kmpl')).toBe('Mileage');
    expect(economyLabel('metric', 'l100')).toBe('Economy');
    expect(obdTiles({}, {...NONE, economy: 5}, {...metric, mileage: 'kmpl'})[0]).toMatchObject({label: 'Mileage now', value: '20.0', unit: 'km/L'});
  });

  it('shows this drive\'s mileage next to the instant one', () => {
    const tiles = obdTiles({}, {...NONE, economy: 5}, {...metric, mileage: 'kmpl', driveL100km: 6.9});
    expect(tiles.map((t) => [t.label, t.value])).toEqual([
      ['Mileage now', '20.0'],
      ['Mileage this drive', '14.5'],
    ]);
  });

  it('shows small fuel amounts in the small unit', () => {
    expect(fuelVolume(0.006, 'metric')).toEqual({value: '6', unit: 'mL'});
    expect(fuelVolume(2.345, 'metric')).toEqual({value: '2.35', unit: 'L'});
    expect(fuelVolume(0.1, 'imperial')).toEqual({value: '3.4', unit: 'fl oz'});
    expect(fuelVolume(7.57, 'imperial')).toEqual({value: '2.00', unit: 'gal'});
  });

  it('labels gears', () => {
    expect(gearLabel(0)).toBe('N');
    expect(gearLabel(3)).toBe('3');
    expect(gearLabel(null)).toBeNull();
  });
});
