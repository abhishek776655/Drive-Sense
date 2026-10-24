import {BatteryWatch, parseVoltage, type BatteryReading} from '../battery';

const watch = () => {
  const readings: BatteryReading[] = [];
  return {w: new BatteryWatch((r) => readings.push(r)), readings};
};

describe('battery watch', () => {
  it('reports the resting voltage and the start dip', () => {
    const {w, readings} = watch();
    // Ignition on, engine off for 15 s, battery at 12.6 V, read 4 times a second.
    for (let t = 0; t <= 15_000; t += 250) {
      w.rpm(0, t);
      w.voltage(12.6, t);
    }
    // Starter: voltage sags to 10.4 V for half a second, then the alternator lifts it.
    w.voltage(10.9, 15_250);
    w.voltage(10.4, 15_500);
    w.rpm(820, 15_750);
    for (let t = 15_750; t <= 19_000; t += 250) {
      w.voltage(14.1, t);
      w.rpm(850, t);
    }
    expect(readings).toEqual([{restingV: 12.6, startDipV: 10.4, at: 15_750}]);
  });

  it('measures a quick restart (auto start-stop) without a resting figure', () => {
    const {w, readings} = watch();
    w.rpm(850, 0);
    w.voltage(14.1, 0);
    w.rpm(0, 1000);
    w.voltage(12.3, 2000);
    w.voltage(11.2, 3500);
    w.rpm(800, 4000);
    w.voltage(14.0, 7500);
    expect(readings).toEqual([{restingV: null, startDipV: 11.2, at: 4000}]);
  });

  it('reports nothing while the engine just runs', () => {
    const {w, readings} = watch();
    for (let t = 0; t <= 20_000; t += 500) {
      w.rpm(2000, t);
      w.voltage(14.2, t);
    }
    expect(readings).toEqual([]);
  });
});

describe('adapter voltage', () => {
  it('reads ATRV replies', () => {
    expect(parseVoltage('12.4V')).toBe(12.4);
    expect(parseVoltage('ATRV\r14.1V\r\r')).toBe(14.1);
    expect(parseVoltage('?')).toBeNull();
  });
});
