import {summarize, type ObdSampleRow} from '../series';

describe('summarize mileage', () => {
  it('counts distance and fuel over the same seconds when PIDs land in different rows', () => {
    // 60 km/h and 6 L/h for 10 minutes: 10 km, 1 L, 10 L/100 km. Some rows carry only one of the two.
    const rows: ObdSampleRow[] = [];
    for (let s = 0; s <= 600; s++) {
      rows.push({ts: s * 1000, row: s % 2 === 0 ? {speed: 60, fuelFlow: 6} : {fuelFlow: 6, coolant: 90}});
    }
    const stats = summarize(rows, 600);
    expect(stats.avgL100km).toBeCloseTo(10, 0);
    expect(stats.fuelUsedL).toBeCloseTo(1, 1);
  });
});
