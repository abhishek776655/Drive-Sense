import {makesFor, matchOptions, modelsFor} from '../vehicleCatalog';

describe('vehicleCatalog', () => {
  it('keeps car and motorbike makes apart', () => {
    expect(makesFor('car')).toContain('Maruti Suzuki');
    expect(makesFor('car')).not.toContain('Royal Enfield');
    expect(makesFor('motorbike')).toContain('Royal Enfield');
    expect(modelsFor('car', 'Skoda')).toContain('Citigo');
    expect(modelsFor('car', 'Nope')).toEqual([]);
  });

  it('lists names starting with the query first, then word matches', () => {
    const options = ['Maruti Suzuki', 'Saab', 'Seat', 'Skoda', 'Suzuki'];
    expect(matchOptions(options, 's')).toEqual(['Saab', 'Seat', 'Skoda', 'Suzuki', 'Maruti Suzuki']);
    expect(matchOptions(options, 'SK')).toEqual(['Skoda']);
    expect(matchOptions(options, '  ')).toEqual([]);
    expect(matchOptions(options, 's', 2)).toHaveLength(2);
  });
});
