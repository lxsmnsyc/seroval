import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';
import {
  DOCS_ERRORS_URL,
  ERROR_CODES,
  type ErrorCode,
  getCatalogEntry,
  getDevMessage,
  getProdMessage,
} from '../../src/core/error-catalog';

const CODES = Object.values(ERROR_CODES) as ErrorCode[];

const RENDER: { [C in ErrorCode]: () => string } = {
  SRV001: () => getDevMessage('SRV001', { value: Symbol('secret') }),
  SRV002: () => getDevMessage('SRV002', { nodeType: 99 }),
  SRV003: () => getDevMessage('SRV003', { tag: 'tag' }),
  SRV004: () => getDevMessage('SRV004', { tag: 'tag' }),
  SRV005: () => getDevMessage('SRV005', { value: {} }),
  SRV006: () => getDevMessage('SRV006', { id: 'id' }),
  SRV007: () => getDevMessage('SRV007', { name: 'Foo' }),
  SRV008: () => getDevMessage('SRV008', { nodeType: 1, nodeId: 2, detail: 'detail' }),
  SRV009: () => getDevMessage('SRV009', { nodeId: 3 }),
  SRV010: () => getDevMessage('SRV010', { limit: 10 }),
  SRV011: () => getDevMessage('SRV011', {}),
  SRV012: () => getDevMessage('SRV012', { reason: 'closed' }),
  SRV013: () => getDevMessage('SRV013', { tag: 'tag', field: 'field' }),
  SRV014: () => getDevMessage('SRV014', { cause: new Error('cause') }),
  SRV015: () => getDevMessage('SRV015', { cause: 'text' }),
  SRV016: () => getDevMessage('SRV016', { cause: new Error('cause') }),
  SRV017: () => getDevMessage('SRV017', {}),
  SRV018: () => getDevMessage('SRV018', {}),
  SRV019: () => getDevMessage('SRV019', { value: -1 }),
  SRV020: () => getDevMessage('SRV020', { limit: 5 }),
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

  it('numbers codes in strictly increasing order up to SRV020', () => {
    // A removed code leaves its number unused, so gaps are allowed.
    let previous = 0;
    for (const code of CODES) {
      const value = Number(code.slice(3));
      expect(value).toBeGreaterThan(previous);
      previous = value;
    }
    expect(CODES[CODES.length - 1]).toBe('SRV020');
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
      expect(RENDER[code]().length).toBeGreaterThan(0);
    }
  });
});

describe('production build', () => {
  it('strips the development messages', async () => {
    const result = await build({
      entryPoints: [fileURLToPath(new URL('../../src/core/error-catalog.ts', import.meta.url))],
      bundle: true,
      minify: true,
      format: 'esm',
      write: false,
      define: { 'import.meta.env.PROD': 'true' },
    });
    const output = result.outputFiles[0].text;
    for (const code of CODES) {
      const entry = getCatalogEntry(code)!;
      expect(output).not.toContain(entry.title);
      expect(output).not.toContain(entry.name);
    }
    expect(output).not.toContain('Malformed node');
    expect(output).not.toContain('Missing plugin');
    expect(output).not.toContain('Depth limit');
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
