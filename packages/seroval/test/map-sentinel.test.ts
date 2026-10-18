import { assert, describe, expect, it } from 'vitest';
import {
  crossSerialize,
  crossSerializeAsync,
  deserialize,
  serialize,
  serializeAsync,
} from '../src';

// An entry whose key is an ancestor and whose value is shared elsewhere is
// assigned after the Map is built. A placeholder entry, the sentinel, holds
// its position until then.
function createValue(): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  const shared = { x: 1 };
  const map = new Map<unknown, unknown>([
    [undefined, 'real'],
    ['k', 1],
  ]);
  root.plain = new Map([[1, 2]]);
  root.map = map;
  map.set(root, shared);
  root.shared = shared;
  return root;
}

function expectValue(back: Record<string, unknown>): void {
  const map = back.map;
  assert(map instanceof Map);
  expect(map.get(back)).toBe(back.shared);
  expect(map.get(undefined)).toBe('real');
  expect(map.size).toBe(3);
  expect([...map.keys()].some((key) => Array.isArray(key))).toBe(false);
}

function evaluateCross(source: string): Record<string, unknown> {
  // oxlint-disable-next-line eslint/no-new-func, typescript/no-implied-eval, typescript/no-unsafe-call, typescript/no-unsafe-return -- evaluates the serialized output.
  return new Function('$R', `return ${source}`)([]);
}

describe('Map sentinel', () => {
  it('is not declared when no entry needs it', () => {
    expect(serialize(new Map([[1, 2]]))).toBe('new Map([[1,2]])');
    const recursive = new Map();
    recursive.set(recursive, recursive);
    expect(serialize(recursive)).not.toContain('[]');
  });

  it('is declared at the start of the output when an entry needs it', () => {
    const result = serialize(createValue());
    expect(result).toMatch(/^\(\([^)]*\)=>\(\w+=\[\],/);
    expectValue(deserialize(result));
  });

  it('works with serializeAsync', async () => {
    expectValue(deserialize(await serializeAsync(createValue())));
  });

  it('works with crossSerialize', () => {
    expectValue(evaluateCross(crossSerialize(createValue())));
  });

  it('works with crossSerializeAsync', async () => {
    expectValue(evaluateCross(await crossSerializeAsync(createValue())));
  });
});
