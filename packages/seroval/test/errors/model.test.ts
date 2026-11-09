import { describe, expect, it } from 'vitest';
import {
  type CatalogDetails,
  DOCS_ERRORS_URL,
  ERROR_CODES,
  type ErrorCode,
  getCatalogEntry,
  getDevMessage,
  getProdMessage,
} from '../../src/core/error-catalog';

const CODES = Object.values(ERROR_CODES) as ErrorCode[];

const SAMPLE_DETAILS: { [C in ErrorCode]: CatalogDetails[C] } = {
  SRV001: { value: Symbol('secret') },
  SRV002: { nodeType: 99 },
  SRV003: { tag: 'tag' },
  SRV004: { tag: 'tag' },
  SRV005: { value: {} },
  SRV006: { id: 'id' },
  SRV007: { name: 'Foo' },
  SRV008: { nodeType: 1, nodeId: 2, detail: 'detail' },
  SRV009: { nodeId: 3 },
  SRV010: { limit: 10 },
  SRV011: {},
  SRV012: { reason: 'closed' },
  SRV013: { tag: 'tag', field: 'field' },
  SRV014: { cause: new Error('cause') },
  SRV015: { cause: 'text' },
  SRV016: { cause: new Error('cause') },
  SRV017: {},
  SRV018: {},
  SRV019: { value: -1 },
  SRV020: { limit: 5 },
  SRV021: { tag: 'tag', expected: 'expected' },
};

describe('error catalog', () => {
  it('has well formed codes', () => {
    for (const code of CODES) {
      expect(code).toMatch(/^SRV\d{3}$/);
    }
  });

  it('has unique codes', () => {
    expect(new Set(CODES).size).toBe(CODES.length);
  });

  it('numbers codes from SRV001 without gaps', () => {
    const numbers: number[] = [];
    for (const code of CODES) {
      numbers.push(Number(code.slice(3)));
    }
    numbers.sort((a, b) => a - b);
    for (let i = 0; i < numbers.length; i++) {
      expect(numbers[i]).toBe(i + 1);
    }
  });

  it('has one entry per code with a unique name', () => {
    const names = new Set<string>();
    for (const code of CODES) {
      const entry = getCatalogEntry(code);
      expect(entry).toBeDefined();
      expect(entry!.code).toBe(code);
      expect(entry!.title.length).toBeGreaterThan(0);
      names.add(entry!.name);
    }
    expect(names.size).toBe(CODES.length);
  });

  it('keeps the old specific numbers as the first 13 codes', () => {
    expect(ERROR_CODES.UnsupportedType).toBe('SRV001');
    expect(ERROR_CODES.PluginValidation).toBe('SRV013');
  });

  it('renders a development message for every code', () => {
    for (const code of CODES) {
      const details = SAMPLE_DETAILS[code];
      expect(getDevMessage(code, details as never).length).toBeGreaterThan(0);
    }
  });
});

describe('production message', () => {
  it('has the code, the step and the link', () => {
    expect(getProdMessage('SRV008', 'deserialize')).toBe(
      'Seroval SRV008 (deserialize): https://seroval.vercel.app/docs/errors/SRV008',
    );
  });

  it('drops the parenthesis without a step', () => {
    expect(getProdMessage('SRV011')).toBe(`Seroval SRV011: ${DOCS_ERRORS_URL}/SRV011`);
  });

  it('is one line without values', () => {
    for (const code of CODES) {
      const message = getProdMessage(code, 'parse');
      expect(message).not.toContain('\n');
      expect(message).toContain(code);
    }
  });
});
