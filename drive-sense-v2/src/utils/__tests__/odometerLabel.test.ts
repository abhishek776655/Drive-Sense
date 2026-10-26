import {odometerLabel} from '../odometerLabel';

const NOW = new Date(2026, 9, 26, 18, 0, 0).getTime();
const at = (day: number, hour = 13) => new Date(2026, 9, day, hour, 2, 0).toISOString();

describe('odometer label', () => {
  it('shows the last odometer reading with when it was read', () => {
    expect(odometerLabel(22120.8, at(26), 'metric', NOW)).toEqual({value: '22,121', label: 'km · today'});
    expect(odometerLabel(22120.8, at(25, 23), 'metric', NOW)).toEqual({value: '22,121', label: 'km · yesterday'});
    expect(odometerLabel(22120.8, at(20), 'imperial', NOW)).toEqual({value: '13,745', label: 'mi · 6 days ago'});
  });
});
