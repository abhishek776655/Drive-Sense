import {pt} from '../../../testUtils/tripPoints';
import {cleanPoints} from '../prepare';
import {buildReplay, replayAt} from '../replay';

const track = () => buildReplay(cleanPoints([pt(0, 0, 0), pt(10, 50, 10), pt(20, 150, 10)]));

describe('buildReplay', () => {
  it('lays the points on a timeline with running distance', () => {
    const r = track();
    expect(r.durationMs).toBe(20_000);
    expect(r.meters[2]).toBeCloseTo(150, 0);
  });

  it('squeezes a paused gap out of the timeline', () => {
    const r = buildReplay(cleanPoints([pt(0, 0, 10), pt(1, 10, 10), pt(2000, 20, 10), pt(2001, 30, 10)]));
    expect(r.durationMs).toBe(2_000);
  });
});

describe('replayAt', () => {
  it('interpolates position, speed and distance between points', () => {
    const f = replayAt(track(), 15_000)!;
    expect(f.meters).toBeCloseTo(100, 0);
    expect(f.kmh).toBeCloseTo(36);
    expect(f.index).toBe(1);
    expect(f.heading).toBeCloseTo(0, 0); // heading north
  });

  it('clamps before the start and after the end', () => {
    expect(replayAt(track(), -5)!.meters).toBe(0);
    expect(replayAt(track(), 99_000)!.meters).toBeCloseTo(150, 0);
  });

  it('is null for an empty trip', () => {
    expect(replayAt(buildReplay([]), 0)).toBeNull();
  });
});
