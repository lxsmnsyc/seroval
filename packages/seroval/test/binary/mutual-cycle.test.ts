import { describe, expect, it } from 'vitest';
import { roundtrip } from './utils';

interface Node {
  name: string;
  peer?: Node;
}

describe('binary mutual cycles', () => {
  it('supports two objects referencing each other', async () => {
    const a: Node = { name: 'a' };
    const b: Node = { name: 'b' };
    a.peer = b;
    b.peer = a;

    const { value } = await roundtrip<Node>(a);
    expect(value.name).toBe('a');
    expect(value.peer?.name).toBe('b');
    expect(value.peer?.peer).toBe(value);
  });

  it('supports cycles through arrays', async () => {
    const list: unknown[] = [];
    const holder = { list };
    list.push(holder);

    const { value } = await roundtrip<{ list: unknown[] }>(holder);
    expect(value.list[0]).toBe(value);
  });

  it('supports cycles through Maps and Sets', async () => {
    const map = new Map<string, unknown>();
    const set = new Set<unknown>();
    map.set('set', set);
    set.add(map);

    const { value } = await roundtrip<Map<string, Set<unknown>>>(map);
    const innerSet = value.get('set');
    expect(innerSet).toBeInstanceOf(Set);
    expect(innerSet?.has(value)).toBe(true);
  });

  it('supports longer cycles', async () => {
    const a: Node = { name: 'a' };
    const b: Node = { name: 'b' };
    const c: Node = { name: 'c' };
    a.peer = b;
    b.peer = c;
    c.peer = a;

    const { value } = await roundtrip<Node>(a);
    expect(value.peer?.peer?.peer).toBe(value);
  });
});
