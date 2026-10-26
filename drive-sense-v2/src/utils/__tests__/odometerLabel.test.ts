import {odometerLabel} from '../odometerLabel';

describe('odometer label', () => {
  it("shows the car's total distance in the chosen unit", () => {
    expect(odometerLabel(22120.8, 'metric')).toEqual({value: '22,121', label: 'Odometer · km'});
    expect(odometerLabel(22120.8, 'imperial')).toEqual({value: '13,745', label: 'Odometer · mi'});
  });
});
