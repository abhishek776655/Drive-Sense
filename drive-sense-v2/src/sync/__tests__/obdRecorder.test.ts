import {setDbForTests} from '../../db';
import {obdSamples, tripObd} from '../../db/obdRepos';
import {useObdStore} from '../../stores/obdStore';
import {useRecordingStore} from '../../stores/recordingStore';
import {memoryDb} from '../../testUtils/memoryDb';
import {finalizeObd, startObdRecorder} from '../obdRecorder';

const T0 = 1_000_000;

afterEach(() => {
  setDbForTests(null);
  useRecordingStore.setState({status: 'ready', startedAt: null});
  useObdStore.getState().reset();
});

/** Feeds `seconds` seconds of 4 Hz speed + rpm readings. */
const feed = (fromS: number, seconds: number) => {
  const s = useObdStore.getState();
  for (let i = 0; i < seconds * 4; i++) {
    const at = T0 + fromS * 1000 + i * 250;
    s.putValue('rpm', 2000 + i, at);
    s.putValue('speed', 50, at);
  }
};

describe('OBD recorder', () => {
  it('writes one row per second only while recording', () => {
    const db = memoryDb();
    setDbForTests(db);
    const stop = startObdRecorder();
    feed(0, 2); // Ready: nothing kept
    useRecordingStore.setState({status: 'recording', startedAt: T0});
    feed(2, 10);
    useRecordingStore.setState({status: 'paused'});
    feed(12, 3); // Paused: nothing kept
    const rows = obdSamples(db, T0);
    expect(rows).toHaveLength(10);
    expect(rows[0].ts).toBe(T0 + 2000);
    expect(rows[0].row).toEqual({rpm: 2003, speed: 50});
    stop();
  });

  it('turns the seconds into a summary and series at the end', () => {
    const db = memoryDb();
    setDbForTests(db);
    const stop = startObdRecorder();
    useRecordingStore.setState({status: 'recording', startedAt: T0});
    feed(0, 30);
    useRecordingStore.setState({status: 'ready'});
    stop();
    const stats = finalizeObd(db, {startedAt: T0, durationSeconds: 30});
    expect(stats?.coverage).toBe(1);
    expect(stats?.maxRpm).toBeGreaterThan(2000);
    expect(obdSamples(db, T0)).toEqual([]);
    expect(tripObd(db, T0)?.series.t).toHaveLength(30);
  });

  it('keeps nothing for a drive without OBD data', () => {
    const db = memoryDb();
    setDbForTests(db);
    expect(finalizeObd(db, {startedAt: T0, durationSeconds: 60})).toBeNull();
    expect(tripObd(db, T0)).toBeNull();
  });
});
