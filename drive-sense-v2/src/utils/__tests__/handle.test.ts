import {handleProblem, normalizeHandle} from '../handle';

describe('handle rules', () => {
  it('normalises what was typed', () => {
    expect(normalizeHandle('  @@Lazarus ')).toBe('lazarus');
  });

  it('matches the server format rules', () => {
    expect(handleProblem('ab')).toBe('At least 3 characters');
    expect(handleProblem('a'.repeat(21))).toBe('At most 20 characters');
    expect(handleProblem('hi there')).toBe('Letters, numbers and _ only');
    expect(handleProblem('road_runner_7')).toBeNull();
  });
});
