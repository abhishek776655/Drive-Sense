import {formatDriveTime} from '../summaryFormat';

describe('formatDriveTime', () => {
  it('shows minutes under an hour and h/m after', () => {
    expect(formatDriveTime(0)).toBe('0 Min');
    expect(formatDriveTime(719)).toBe('11 Min');
    expect(formatDriveTime(3900)).toBe('1h 5m');
  });
});
