import {EMPTY_STATS, useRecordingStore, type RecordingState} from '../../stores/recordingStore';
import {resetDriveActivitySync, SAVED_FOR_MS, startDriveActivitySync, syncDriveActivity} from '../driveActivitySync';
import {widgetsNative} from '../native';

jest.mock('../native', () => ({widgetsNative: jest.fn()}));

const NOW = 1_800_000_000_000;

const handle = () => ({update: jest.fn().mockResolvedValue(undefined), end: jest.fn().mockResolvedValue(undefined)});

const setup = (running: ReturnType<typeof handle>[] = []) => {
  const started = handle();
  const native = {
    activity: {start: jest.fn(() => started), getInstances: jest.fn(() => running)},
    week: {updateSnapshot: jest.fn()},
    after: (date: Date) => ({after: date}),
  };
  (widgetsNative as jest.Mock).mockReturnValue(native);
  return {native, started};
};

const ready = (): RecordingState => ({...useRecordingStore.getState(), status: 'ready', startedAt: null});
const live = (minutes: number, distanceM: number): RecordingState => ({
  ...ready(),
  status: 'recording',
  startedAt: NOW - minutes * 60_000,
  stats: {...EMPTY_STATS, distanceM, movingSeconds: minutes * 60},
});

beforeEach(() => {
  resetDriveActivitySync();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('Live Activity sync', () => {
  it('starts with the drive, throttles updates, and ends as the saved card', () => {
    const {native, started} = setup();
    syncDriveActivity(live(1, 500), ready(), NOW);
    expect(native.activity.start).toHaveBeenCalledWith(expect.objectContaining({state: 'recording', distance: '0.5 km'}), 'drivesensev2://drive');

    syncDriveActivity(live(1, 700), live(1, 500), NOW + 1000);
    expect(started.update).not.toHaveBeenCalled();
    syncDriveActivity(live(2, 900), live(1, 700), NOW + 6000);
    expect(started.update).toHaveBeenCalledWith(expect.objectContaining({distance: '0.9 km'}));

    syncDriveActivity(ready(), live(2, 900), NOW + 7000);
    expect(started.end).toHaveBeenCalledWith({after: new Date(NOW + 7000 + SAVED_FOR_MS)}, expect.objectContaining({state: 'saved', distance: '0.9 km'}), new Date(NOW + 7000));
  });

  it('does nothing where Live Activities are not available', () => {
    (widgetsNative as jest.Mock).mockReturnValue(null);
    expect(() => syncDriveActivity(live(1, 500), ready(), NOW)).not.toThrow();
  });

  it('keeps recording when the system refuses to start one', () => {
    const {native} = setup();
    native.activity.start.mockImplementation(() => {
      throw new Error('disabled');
    });
    expect(() => syncDriveActivity(live(1, 500), ready(), NOW)).not.toThrow();
  });

  it('closes leftovers on launch when no drive is running', () => {
    const orphan = handle();
    setup([orphan]);
    useRecordingStore.setState({status: 'ready', startedAt: null});
    const stop = startDriveActivitySync();
    expect(orphan.end).toHaveBeenCalledWith('immediate');
    stop();
  });

  it('adopts the running activity for a drive restored after a relaunch', () => {
    const adopted = handle();
    const extra = handle();
    const {native} = setup([adopted, extra]);
    useRecordingStore.setState({status: 'recording', startedAt: Date.now() - 60_000, stats: {...EMPTY_STATS, distanceM: 500}});
    const stop = startDriveActivitySync();
    expect(native.activity.start).not.toHaveBeenCalled();
    expect(adopted.update).toHaveBeenCalled();
    expect(adopted.end).not.toHaveBeenCalled();
    expect(extra.end).toHaveBeenCalledWith('immediate');
    stop();
    useRecordingStore.setState({status: 'ready', startedAt: null});
  });
});
