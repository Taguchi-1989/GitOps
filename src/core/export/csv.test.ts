/**
 * FlowOps - CSV Serialization Tests
 */

import { describe, it, expect } from 'vitest';
import { escapeCsvCell, toCsv, toCsvWithBom, UTF8_BOM } from './csv';

describe('escapeCsvCell', () => {
  it('passes through plain text', () => {
    expect(escapeCsvCell('hello')).toBe('hello');
  });

  it('renders null/undefined as empty string', () => {
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(undefined)).toBe('');
  });

  it('quotes cells containing commas', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
  });

  it('quotes and doubles inner quotes', () => {
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it('quotes cells with newlines', () => {
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('neutralizes CSV injection (formula prefixes)', () => {
    expect(escapeCsvCell('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)");
    expect(escapeCsvCell('+1')).toBe("'+1");
    expect(escapeCsvCell('-1')).toBe("'-1");
    expect(escapeCsvCell('@cmd')).toBe("'@cmd");
  });

  it('quotes when injection guard + comma combine', () => {
    // '=a,b → guard adds leading quote-char, then comma forces wrapping
    expect(escapeCsvCell('=a,b')).toBe('"\'=a,b"');
  });
});

describe('toCsv', () => {
  it('joins headers and rows with CRLF', () => {
    const csv = toCsv(
      ['id', 'name'],
      [
        ['1', 'foo'],
        ['2', 'bar'],
      ]
    );
    expect(csv).toBe('id,name\r\n1,foo\r\n2,bar');
  });
});

describe('toCsvWithBom', () => {
  it('prepends the UTF-8 BOM', () => {
    const csv = toCsvWithBom(['a'], [['b']]);
    expect(csv.startsWith(UTF8_BOM)).toBe(true);
    expect(csv).toBe(`${UTF8_BOM}a\r\nb`);
  });
});
