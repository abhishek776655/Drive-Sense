import {ALL_STATS} from '../../stores/driveSettingsStore';
import type {LiveStats} from '../../stores/recordingStore';
import {DASH} from '../format';
import {statDisplay} from '../liveStats';

const stats: LiveStats = {
  speedMps: 10,
  distanceM: 4200,
  topSpeedMps: 21.7,
  altitudeM: 241,
  elevationGainM: 12,
  headingDeg: 90,
  moving: true,
  accuracyM: 4.6,
  smoothness: 'moderate',
  eventCount: 1,
  brakeCount: 0,
  accelCount: 1,
  overspeedIntensity: 0,
  movingSeconds: 400,
  liveG: null,
  maxG: null,
};

describe('statDisplay', () => {
  it('has a display for every pickable stat', () => {
    for (const id of ALL_STATS) {
      expect(statDisplay(id, stats, 400, 'metric').value).toBeTruthy();
    }
  });

  it('formats live values and dashes missing sensor data', () => {
    expect(statDisplay('distance', stats, 400, 'metric').value).toBe('4.2');
    expect(statDisplay('avgSpeed', stats, 400, 'metric').value).toBe('38');
    expect(statDisplay('topSpeed', stats, 400, 'metric').value).toBe('78');
    expect(statDisplay('heading', stats, 400, 'metric').value).toBe('90° E');
    expect(statDisplay('heading', {...stats, moving: false}, 400, 'metric').value).toBe(DASH);
    expect(statDisplay('smoothness', stats, 400, 'metric')).toMatchObject({value: 'Moderate', valueTone: 'amber'});
    expect(statDisplay('accuracy', stats, 400, 'metric').value).toBe('±5');
    expect(statDisplay('maxG', stats, 400, 'metric').value).toBe(DASH);
    expect(statDisplay('liveScore', stats, 400, 'metric')).toMatchObject({value: '98', valueTone: 'green'});
    expect(statDisplay('liveScore', stats, 0, 'metric').value).toBe(DASH);
    expect(statDisplay('avgSpeed', {...stats, movingSeconds: 0}, 400, 'metric').value).toBe(DASH);
  });

  it('shows distance and speed in the chosen units', () => {
    expect(statDisplay('distance', stats, 400, 'imperial')).toMatchObject({value: '2.6', unit: 'mi', short: 'MI'});
    expect(statDisplay('avgSpeed', stats, 400, 'imperial')).toMatchObject({value: '23', unit: 'mph', short: 'Ø MPH'});
    expect(statDisplay('topSpeed', stats, 400, 'imperial')).toMatchObject({value: '49', unit: 'mph'});
    expect(statDisplay('distance', stats, 400, 'metric')).toMatchObject({unit: 'km', short: 'KM'});
  });
});
