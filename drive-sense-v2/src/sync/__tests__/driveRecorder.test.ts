import {setDbForTests} from '../../db';
import {drivePoints, outboxList, outboxPut, outboxId, putLocalTrip, getDetail, listTrips} from '../../db/repos';
import {useRecordingStore, type Sample} from '../../stores/recordingStore';
import {memoryDb} from '../../testUtils/memoryDb';
import {tripMetrics} from '../../utils/tripMetrics';
import {startDriveRecorder} from '../driveRecorder';

const fix = (s: number, speed = 10): Sample => ({latitude: 28.6, longitude: 77.2 + s / 10000, speedMps: speed, altitudeM: null, headingDeg: 90, accuracyM: 5, timestamp: 1000 + s * 1000});

afterEach(() => {
  setDbForTests(null);
  useRecordingStore.setState({status: 'ready', startedAt: null, pending: []});
});

describe('drive recorder', () => {
  it('keeps every fix of the drive even after the upload queue sends them', () => {
    const db = memoryDb();
    setDbForTests(db);
    const stop = startDriveRecorder();
    useRecordingStore.setState({status: 'recording', startedAt: 1000, pending: [fix(0), fix(1)]});
    useRecordingStore.setState({pending: []}); // a batch went to the server
    useRecordingStore.setState({pending: [fix(2, 0)]});
    useRecordingStore.setState({pending: [fix(1), fix(2, 0)]}); // a failed batch put back in front
    expect(drivePoints(db, 1000).map((p) => p.timestamp)).toEqual([1000, 2000, 3000]);
    stop();
  });

  it('scores the whole drive and saves the phone numbers with the drive', () => {
    const db = memoryDb();
    setDbForTests(db);
    const points = [fix(0, 12), fix(2, 0)];
    const metrics = tripMetrics(points);
    const drive = {
      vehicle: {id: 'v1', name: 'Car'},
      tripId: null,
      startedAt: 1000,
      endedAt: 3000,
      durationSeconds: 2,
      distanceM: 20,
      topSpeedMps: 12,
      avgSpeedMps: 10,
      eventCount: 0,
      score: 100,
      maxG: null,
      route: [],
      unsentSamples: [],
      autoEnded: false,
    };
    outboxPut(db, {id: outboxId(drive), drive, samples: [], progress: {tripId: null, uploadedPoints: 0, ended: false}, metrics});
    putLocalTrip(db, drive, metrics, points);
    expect(outboxList(db)[0].metrics?.score).toBe(98);
    expect(listTrips(db, {}).items[0]).toMatchObject({driving_score: 98, event_count: 1});
    expect(getDetail(db, 'local:1000')).toMatchObject({events: [{event_type: 'harsh_brake'}], idle_time_seconds: 2});
    expect(getDetail(db, 'local:1000')?.location_points[0].speed_mps).toBe(12);
  });
});
