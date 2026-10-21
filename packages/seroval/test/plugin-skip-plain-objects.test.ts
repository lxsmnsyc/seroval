import { describe, expect, it } from 'vitest';
import type { Plugin, SerovalNode } from '../src';
import {
  createPlugin,
  crossSerialize,
  crossSerializeAsync,
  crossSerializeStream,
  serialize,
  serializeAsync,
} from '../src';

class Point {
  x: number;

  constructor(x: number) {
    this.x = x;
  }
}

// Matches every object with an `x` field, plain or not.
function createPointPlugin(skipPlainObjects?: boolean): Plugin<{ x: number }, { x: SerovalNode }> {
  return createPlugin<{ x: number }, { x: SerovalNode }>({
    tag: 'point',
    skipPlainObjects,
    test(value) {
      return typeof value === 'object' && value !== null && 'x' in value;
    },
    parse: {
      sync: (value, ctx) => ({ x: ctx.parse(value.x) }),
      async: async (value, ctx) => ({ x: await ctx.parse(value.x) }),
      stream: (value, ctx) => ({ x: ctx.parse(value.x) }),
    },
    serialize: (node, ctx) => `$point(${ctx.serialize(node.x)})`,
    deserialize: (node, ctx) => new Point(ctx.deserialize<number>(node.x)),
  });
}

const SKIP = createPointPlugin(true);
const TEST = createPointPlugin();
// oxlint-disable-next-line no-unsafe-type-assertion -- A null prototype object.
const VALUE = [{ x: 1 }, new Point(2), Object.assign(Object.create(null) as object, { x: 3 })];

async function streamOutput(plugin: Plugin<{ x: number }, { x: SerovalNode }>): Promise<string> {
  return await new Promise((resolve, reject) => {
    let output = '';
    crossSerializeStream(VALUE, {
      plugins: [plugin],
      onSerialize(data) {
        output += data;
      },
      onError: reject,
      onDone() {
        resolve(output);
      },
    });
  });
}

describe('skipPlainObjects', () => {
  it('tests plain objects by default', () => {
    expect(serialize(VALUE, { plugins: [TEST] })).toBe('[$point(1),$point(2),$point(3)]');
  });

  it('skips plain objects only', async () => {
    const expected = '[{x:1},$point(2),$point(3)]';
    expect(serialize(VALUE, { plugins: [SKIP] })).toBe(expected);
    expect(await serializeAsync(VALUE, { plugins: [SKIP] })).toBe(expected);
    const cross = '$R[0]=[$R[1]={x:1},$R[2]=$point(2),$R[3]=$point(3)]';
    expect(crossSerialize(VALUE, { plugins: [SKIP] })).toBe(cross);
    expect(await crossSerializeAsync(VALUE, { plugins: [SKIP] })).toBe(cross);
    expect(await streamOutput(SKIP)).toBe(cross);
    expect(await streamOutput(TEST)).toBe(
      '$R[0]=[$R[1]=$point(1),$R[2]=$point(2),$R[3]=$point(3)]',
    );
  });

  it('tests instances whose constructor reads as Object', () => {
    // An older class pattern: the prototype is replaced with an object
    // literal, so instances inherit `constructor` from `Object.prototype`.
    function LegacyPoint(this: { x: number }, x: number): void {
      this.x = x;
    }
    LegacyPoint.prototype = { kind: 'legacy' };
    // oxlint-disable-next-line no-unsafe-type-assertion -- Calls the legacy constructor with `new`.
    const legacy = new (LegacyPoint as unknown as new (x: number) => { x: number })(1);
    const ownConstructor = Object.assign(new Point(2), { constructor: Object });
    expect(legacy.constructor).toBe(Object);
    expect(serialize([legacy, ownConstructor, { x: 3 }], { plugins: [SKIP] })).toBe(
      '[$point(1),$point(2),{x:3}]',
    );
  });

  it('keeps testing the other plugins for plain objects', () => {
    const other = createPlugin<{ y: number }, { y: SerovalNode }>({
      tag: 'other',
      test: (value) => typeof value === 'object' && value !== null && 'y' in value,
      parse: { sync: (value, ctx) => ({ y: ctx.parse(value.y) }) },
      serialize: (node, ctx) => `$other(${ctx.serialize(node.y)})`,
      deserialize: () => ({ y: 0 }),
    });
    expect(serialize([{ x: 1 }, { y: 2 }, new Point(3)], { plugins: [SKIP, other] })).toBe(
      '[{x:1},$other(2),$point(3)]',
    );
  });
});
