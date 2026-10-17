import {resolveTripRiskLevel} from '../tripRisk';

describe('resolveTripRiskLevel', () => {
  it('flags three or more events as high risk', () => {
    expect(resolveTripRiskLevel({eventCount: 3, score: 95, isCompleted: true})).toBe('high');
  });

  it('treats any event as at least a watch', () => {
    expect(resolveTripRiskLevel({eventCount: 1, score: 95, isCompleted: true})).toBe('medium');
  });

  it('watches a completed trip that scored below 80', () => {
    expect(resolveTripRiskLevel({eventCount: 0, score: 72, isCompleted: true})).toBe('medium');
  });

  it('does not hold a placeholder score against a trip still running', () => {
    expect(resolveTripRiskLevel({eventCount: 0, score: 0, isCompleted: false})).toBe('low');
  });

  it('calls a clean completed trip low risk', () => {
    expect(resolveTripRiskLevel({eventCount: 0, score: 88, isCompleted: true})).toBe('low');
  });
});
