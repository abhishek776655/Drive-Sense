import {thin} from '../thin';

describe('thin', () => {
  it('returns the input when already small enough', () => {
    expect(thin([1, 2, 3], 5)).toEqual([1, 2, 3]);
  });

  it('keeps first and last and spaces the rest evenly', () => {
    const out = thin(Array.from({length: 101}, (_, i) => i), 5);
    expect(out).toEqual([0, 25, 50, 75, 100]);
  });
});
