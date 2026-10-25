import {useSensorDriveStore} from '../sensorDriveStore';

describe('sensor drive store', () => {
  beforeEach(() => useSensorDriveStore.getState().reset());

  it('builds the drive summary from corners, road and phone use', () => {
    const s = useSensorDriveStore.getState();
    expect(s.summary()).toBeNull();
    [0.05, 0.3, 0.05].forEach((g, i) => s.addLateralG(g, i * 100, {latitude: i, longitude: 0}));
    for (let d = 0; d <= 100; d += 10) {
      s.addVertical(0.1, d, {latitude: 5, longitude: 5});
    }
    s.addPhoneUse(0, 3000);
    const sum = useSensorDriveStore.getState().summary();
    expect(sum).toMatchObject({corners: {count: 1, hardest: {peakG: 0.3}}, road: {summary: {smooth: 1, fair: 0, rough: 0}}, phoneUseS: 3});
  });
});
