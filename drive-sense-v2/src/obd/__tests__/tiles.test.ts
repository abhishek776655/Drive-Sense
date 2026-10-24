import {economy, economyLabel, fuelFlow, fuelVolume, gearLabel, obdTiles} from '../tiles';

const NONE = {fuelFlow: null, economy: null, boost: null, gear: null};
const metric = {units: 'metric' as const, temperature: 'c' as const, engineRunning: true};

describe('OBD tiles', () => {
  it('shows only what the car reports', () => {
    expect(obdTiles({}, NONE, metric)).toEqual([]);
    const ids = obdTiles({coolant: {v: 90}, voltage: {v: 14.1}}, {...NONE, fuelFlow: 4}, metric).map((t) => t.id);
    expect(ids).toEqual(['coolant', 'fuelFlow', 'voltage']);
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
    expect(fuelFlow(3.785411784, 'imperial')).toEqual({value: '1.00', unit: 'gal/h'});
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
