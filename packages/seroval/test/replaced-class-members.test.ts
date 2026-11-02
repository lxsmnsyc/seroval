import { describe, expect, it } from 'vitest';
import {
  Sequence,
  compileJSON,
  crossSerialize,
  crossSerializeAsync,
  serialize,
  serializeAsync,
  toJSON,
} from '../src';

const MARK = '__serovalReplacedClassMember';
const QUOTED = `Z");globalThis.${MARK}=1;("`;
const BARE = `0);globalThis.${MARK}=1;(`;

function getMark(): unknown {
  return (globalThis as Record<string, unknown>)[MARK];
}

function evaluate(output: string): unknown {
  return (0, eval)('(' + output + ')');
}

async function getOutputs(create: () => unknown): Promise<string[]> {
  const outputs: string[] = [];
  for (const run of [
    () => serialize(create()),
    () => compileJSON(toJSON(create())),
    async () => serializeAsync(create()),
  ]) {
    try {
      outputs.push(await run());
    } catch {
      // Rejecting the value is a safe outcome.
    }
  }
  return outputs;
}

async function expectInert(create: () => unknown): Promise<void> {
  for (const output of await getOutputs(create)) {
    Reflect.deleteProperty(globalThis, MARK);
    try {
      evaluate(output);
    } catch {
      // Output that fails to evaluate cannot have run the payload.
    }
    expect(getMark()).toBeUndefined();
  }
  // Cross outputs need the `$R` runtime to run, so check the text instead.
  for (const run of [() => crossSerialize(create()), async () => crossSerializeAsync(create())]) {
    let output = '';
    try {
      output = await run();
    } catch {
      // Rejecting the value is a safe outcome.
    }
    expect(output).not.toContain(MARK);
  }
}

function defineOwn<T extends object>(target: T, key: string, value: unknown): T {
  Object.defineProperty(target, key, { value });
  return target;
}

const FORGED: [string, () => unknown][] = [
  [
    'an own Date constructor',
    () => ({ constructor: Date, valueOf: () => 1, toISOString: () => QUOTED }),
  ],
  [
    'a Date constructor on the prototype',
    () =>
      Object.assign(Object.create({ constructor: Date }), {
        valueOf: () => 1,
        toISOString: () => QUOTED,
      }),
  ],
  [
    'an object with Date.prototype',
    () =>
      Object.assign(Object.create(Date.prototype), { valueOf: () => 1, toISOString: () => QUOTED }),
  ],
  [
    'an own Temporal constructor',
    () => ({ constructor: Temporal.PlainDate, toString: () => QUOTED }),
  ],
  [
    'an own DataView constructor',
    () => ({ constructor: DataView, buffer: new ArrayBuffer(4), byteOffset: BARE, byteLength: 4 }),
  ],
  [
    'an own Uint8Array constructor',
    () => ({ constructor: Uint8Array, buffer: new ArrayBuffer(4), byteOffset: BARE, length: 4 }),
  ],
];

const REPLACED: [string, () => unknown][] = [
  ['Date toISOString', () => Object.assign(new Date(0), { toISOString: () => QUOTED })],
  [
    'Date valueOf',
    () => Object.assign(new Date(0), { valueOf: () => 1, toISOString: () => QUOTED }),
  ],
  [
    'Temporal toString',
    () => Object.assign(Temporal.PlainDate.from('2026-01-01'), { toString: () => QUOTED }),
  ],
  ['Uint8Array byteOffset', () => defineOwn(new Uint8Array(4), 'byteOffset', BARE)],
  ['Uint8Array length', () => defineOwn(new Uint8Array(4), 'length', BARE)],
  ['BigInt64Array byteOffset', () => defineOwn(new BigInt64Array(4), 'byteOffset', BARE)],
  ['DataView byteOffset', () => defineOwn(new DataView(new ArrayBuffer(4)), 'byteOffset', BARE)],
  ['DataView byteLength', () => defineOwn(new DataView(new ArrayBuffer(4)), 'byteLength', BARE)],
];

describe('values that replace class members', () => {
  it.each(FORGED)('does not inject code through %s', async (_, create) => {
    await expectInert(create);
  });

  it.each(FORGED)('does not write %s as that class', (_, create) => {
    let output: string | undefined;
    try {
      output = serialize(create());
    } catch {
      return;
    }
    expect(output).not.toMatch(/new (Date|DataView|Uint8Array)|Temporal\./);
  });

  it.each(REPLACED)('ignores an own %s', async (_, create) => {
    await expectInert(create);
  });

  it('reads a Date through its internal state', () => {
    const back = evaluate(serialize(Object.assign(new Date(0), { toISOString: () => QUOTED })));
    expect(back).toBeInstanceOf(Date);
    expect((back as Date).getTime()).toBe(0);
  });

  it('reads a Temporal value through its internal state', () => {
    const back = evaluate(
      serialize(Object.assign(Temporal.PlainDate.from('2026-01-01'), { toString: () => QUOTED })),
    );
    expect(String(back)).toBe('2026-01-01');
  });

  it('reads a typed array through its internal state', () => {
    const value = defineOwn(
      defineOwn(new Uint8Array(new ArrayBuffer(8), 2, 4), 'byteOffset', BARE),
      'buffer',
      { forged: true },
    );
    const back = evaluate(serialize(value)) as Uint8Array;
    expect(back).toBeInstanceOf(Uint8Array);
    expect(back.byteOffset).toBe(2);
    expect(back.length).toBe(4);
  });

  it('does not inject code through Sequence fields', async () => {
    await expectInert(
      () => new Sequence([1], BARE as unknown as number, BARE as unknown as number),
    );
  });
});
