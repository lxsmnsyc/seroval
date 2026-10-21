import { describe, expect, it } from 'vitest';
import { crossSerialize, crossSerializeAsync, serialize, serializeAsync } from '../src';

function evaluate<T>(code: string, refs: unknown[] = []): T {
  // oxlint-disable-next-line eslint/no-new-func, typescript/no-implied-eval, typescript/no-unsafe-call, typescript/no-unsafe-type-assertion -- evaluates the serialized output.
  return new Function('$R', `return (${code})`)(refs) as T;
}

function cycle(): Record<string, unknown> {
  const value: Record<string, unknown> = { a: 1 };
  value.self = value;
  return value;
}

const SYNC_VALUES: [string, () => unknown][] = [
  ['primitives', () => [1, -0, Number.NaN, 'a"<', true, null, undefined, 10n]],
  ['nested objects', () => ({ a: { b: { c: [1, 2, { d: 'e' }] } }, 'x-y': 1, 0: 2 })],
  ['holes', () => [1, , 3]],
  [
    'shared references',
    () => {
      const shared = { id: 1 };
      return { a: shared, b: [shared, shared], c: { d: shared } };
    },
  ],
  ['object cycle', cycle],
  [
    'array cycle',
    () => {
      const value: unknown[] = [1];
      value.push(value, [value]);
      return value;
    },
  ],
  [
    'mutual cycle',
    () => {
      const a: Record<string, unknown> = {};
      const b: Record<string, unknown> = { a };
      a.b = b;
      return [a, b];
    },
  ],
  [
    'map',
    () => {
      const map = new Map<unknown, unknown>([['a', 1]]);
      map.set(map, 'key');
      map.set('value', map);
      map.set({ x: 1 }, { y: 2 });
      return { map };
    },
  ],
  [
    'set',
    () => {
      const set = new Set<unknown>([1, 'a']);
      set.add(set);
      set.add({ x: 1 });
      return set;
    },
  ],
  [
    'frozen and sealed cycles',
    () => {
      const frozen: Record<string, unknown> = { a: 1 };
      frozen.self = frozen;
      Object.freeze(frozen);
      const sealed = Object.seal([1, frozen]);
      return Object.preventExtensions({ frozen, sealed });
    },
  ],
  [
    '__proto__ keys',
    () => {
      const value = JSON.parse('{"__proto__":{"a":1},"b":2}') as Record<string, unknown>;
      value.self = value;
      return value;
    },
  ],
  [
    'null prototype',
    () => {
      const value = Object.create(null) as Record<string, unknown>;
      value.self = value;
      value.x = { y: value };
      return value;
    },
  ],
  [
    'errors',
    () => {
      const error = new Error('message', { cause: 'cause' }) as Error & { self?: unknown };
      error.self = error;
      const other = new TypeError('type');
      // Fixed stacks, so separately created values give the same output.
      error.stack = 'stack';
      other.stack = 'other stack';
      return [error, other];
    },
  ],
  [
    'built-ins',
    () => {
      const buffer = new ArrayBuffer(8);
      return {
        date: new Date(0),
        regexp: /a<b/gi,
        first: new Uint8Array(buffer, 0, 4),
        second: new Uint8Array(buffer, 4, 4),
        view: new DataView(buffer),
        other: new Uint16Array([1, 2]),
        boxed: [Object(1), Object('a'), Object(true), Object(1n)],
        symbols: [Symbol.iterator, Symbol.iterator, Symbol.asyncIterator],
      };
    },
  ],
  [
    'iterables',
    () => {
      const make = (): Iterable<unknown> => ({
        *[Symbol.iterator](): Generator<unknown> {
          yield 1;
          yield 2;
        },
      });
      return [make(), make()];
    },
  ],
];

const ASYNC_VALUES: [string, () => unknown][] = [
  [
    'promises',
    () => {
      const value: Record<string, unknown> = { a: 1 };
      value.self = Promise.resolve(value);
      value.other = Promise.resolve({ b: 2 });
      return value;
    },
  ],
  [
    'async iterables',
    () => ({
      async *[Symbol.asyncIterator](): AsyncGenerator<unknown> {
        await Promise.resolve();
        yield 1;
        yield { a: 2 };
      },
    }),
  ],
];

describe('assignSharedRefsOnly', () => {
  describe('crossSerialize', () => {
    it.each(SYNC_VALUES)('evaluates %s like the default output', (_name, create) => {
      const value = create();
      const expected = serialize(evaluate(crossSerialize(value)));
      const code = crossSerialize(value, { assignSharedRefsOnly: true });
      expect(serialize(evaluate(code))).toBe(expected);
      const scoped = crossSerialize(value, { assignSharedRefsOnly: true, scopeId: 'x' });
      expect(serialize(evaluate(scoped, { x: [] } as unknown as unknown[]))).toBe(expected);
    });

    it('leaves out the references that are read once', () => {
      expect(crossSerialize({ a: { b: [1] } }, { assignSharedRefsOnly: true })).toBe(
        '({a:{b:[1]}})',
      );
      expect(crossSerialize({ a: { b: [1] } })).toBe('($R[0]={a:$R[1]={b:$R[2]=[1]}})');
      const shared = { id: 1 };
      expect(crossSerialize([shared, { shared }], { assignSharedRefsOnly: true })).toBe(
        '[$R[1]={id:1},{shared:$R[1]}]',
      );
    });

    it('assigns the root when patches read it', () => {
      const code = crossSerialize(cycle(), { assignSharedRefsOnly: true });
      expect(code).toBe('($R[0]={a:1},$R[0].self=$R[0],$R[0])');
      const back = evaluate<Record<string, unknown>>(code);
      expect(back.self).toBe(back);
    });

    it('reads references from earlier default output', () => {
      const refs = new Map<unknown, number>();
      const shared = { id: 1 };
      const $R: unknown[] = [];
      const first = evaluate<{ shared: unknown }>(crossSerialize({ shared }, { refs }), $R);
      const second = evaluate<{ again: unknown; other: unknown }>(
        crossSerialize({ again: shared, other: { x: 1 } }, { refs, assignSharedRefsOnly: true }),
        $R,
      );
      expect(second.again).toBe(first.shared);
      expect(second.other).toStrictEqual({ x: 1 });
    });
  });

  describe('crossSerializeAsync', () => {
    it.each([...SYNC_VALUES, ...ASYNC_VALUES])(
      'evaluates %s like the default output',
      async (_name, create) => {
        // Async iterables can only be read once, so each output gets a new value.
        const expected = await serializeAsync(evaluate(await crossSerializeAsync(create())));
        const code = await crossSerializeAsync(create(), { assignSharedRefsOnly: true });
        expect(await serializeAsync(evaluate(code))).toBe(expected);
      },
    );
  });
});
