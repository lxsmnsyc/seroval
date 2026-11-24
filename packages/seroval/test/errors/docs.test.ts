import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ERROR_CODES, type ErrorCode, getCatalogEntry } from '../../src/core/error-catalog';

const CODES = Object.values(ERROR_CODES) as ErrorCode[];

const DOCS_DIR = fileURLToPath(new URL('../../../../website/src/content/docs/', import.meta.url));
const PAGES_DIR = DOCS_DIR + 'errors/';
const SIDEBAR_FILE = fileURLToPath(
  new URL('../../../../website/src/content/sidebar.ts', import.meta.url),
);

const FRONTMATTER = /^---\ntitle: (.*)\ndescription: (.*)\n---\n/;

function readPage(code: string): string {
  return readFileSync(PAGES_DIR + code + '.md', 'utf8');
}

function listPageCodes(): string[] {
  const codes: string[] = [];
  for (const name of readdirSync(PAGES_DIR)) {
    if (name.endsWith('.md')) {
      codes.push(name.slice(0, -'.md'.length));
    }
  }
  return codes.sort();
}

describe('error docs', () => {
  it('has one page per catalog code and no other page', () => {
    expect(listPageCodes()).toEqual([...CODES].sort());
  });

  it('titles each page with its code and the catalog title', () => {
    for (const code of CODES) {
      const match = FRONTMATTER.exec(readPage(code));
      expect(match, code).not.toBeNull();
      expect(match![1]).toBe(code);
      expect(match![2]).toBe(getCatalogEntry(code)!.title + '.');
    }
  });

  it('names the error of each code on its page', () => {
    for (const code of CODES) {
      expect(readPage(code), code).toContain('`' + getCatalogEntry(code)!.name + '`');
    }
  });

  it('links every code from the index', () => {
    const index = readFileSync(DOCS_DIR + 'errors.md', 'utf8');
    for (const code of CODES) {
      expect(index, code).toContain('[' + code + '](./errors/' + code + '.md)');
    }
  });

  it('lists every page in the sidebar', () => {
    const sidebar = readFileSync(SIDEBAR_FILE, 'utf8');
    for (const code of CODES) {
      expect(sidebar, code).toContain("'errors/" + code + "'");
    }
  });
});
