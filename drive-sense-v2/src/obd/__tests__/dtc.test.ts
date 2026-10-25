import {decodeDtc, describeDtc, parseDtcReply} from '../dtc';

describe('trouble codes', () => {
  it('decodes the two-byte form', () => {
    expect(decodeDtc(0x01, 0x33)).toBe('P0133');
    expect(decodeDtc(0x04, 0x20)).toBe('P0420');
    expect(decodeDtc(0xc1, 0x00)).toBe('U0100');
    expect(decodeDtc(0x41, 0x23)).toBe('C0123');
    expect(decodeDtc(0, 0)).toBeNull();
  });

  it('reads CAN replies with a count byte', () => {
    expect(parseDtcReply('43 02 01 33 04 20\r\r>')).toEqual(['P0133', 'P0420']);
    expect(parseDtcReply('43 00')).toEqual([]);
  });

  it('reads older three-per-line replies with padding', () => {
    expect(parseDtcReply('43 03 01 04 20 00 00\r43 01 71 00 00 00 00')).toEqual(['P0301', 'P0420', 'P0171']);
  });

  it('ignores NO DATA and junk', () => {
    expect(parseDtcReply('NO DATA')).toEqual([]);
    expect(parseDtcReply('?')).toEqual([]);
  });

  it('explains known codes and groups unknown ones by system', () => {
    expect(describeDtc('P0420')).toMatchObject({meaning: 'Catalytic converter efficiency below threshold (bank 1)', system: 'emissions', icon: 'cloud'});
    expect(describeDtc('P0308')).toMatchObject({meaning: 'Ignition / misfire fault', system: 'misfire'});
    expect(describeDtc('B1234')).toMatchObject({system: 'body', systemName: 'Body'});
  });
});
