import {economy, fuelFlow, gearLabel, obdTiles} from '../tiles';

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

  it('labels gears', () => {
    expect(gearLabel(0)).toBe('N');
    expect(gearLabel(3)).toBe('3');
    expect(gearLabel(null)).toBeNull();
  });
});
