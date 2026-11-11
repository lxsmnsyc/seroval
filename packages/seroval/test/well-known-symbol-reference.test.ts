import { describe, expect, it } from 'vitest';
import {
  crossSerializeStream,
  fromCrossJSON,
  fromJSON,
  toCrossJSON,
  toCrossJSONStream,
  toJSON,
} from '../src';

const VALUE = { a: Symbol.iterator, b: Symbol.iterator };

async function* count(n: number): AsyncGenerator<number> {
  for (let i = 0; i < n; i++) {
    yield i;
  }
}

describe('a well-known symbol used twice', () => {
  it('keeps both uses with fromJSON', () => {
    expect(fromJSON<typeof VALUE>(toJSON(VALUE))).toEqual(VALUE);
  });

  it('keeps both uses with fromCrossJSON', () => {
    const json = toCrossJSON(VALUE, { refs: new Map() });
    expect(fromCrossJSON<typeof VALUE>(json, { refs: new Map() })).toEqual(VALUE);
  });

  it('decodes two async iterables in one value from cross JSON', async () => {
    const refs = new Map<number, unknown>();
    let root: [AsyncIterable<number>, AsyncIterable<number>] | undefined;
    await new Promise<void>((resolve, reject) => {
      toCrossJSONStream([count(3), count(2)], {
        refs: new Map(),
        onParse(node, initial) {
          const value = fromCrossJSON<[AsyncIterable<number>, AsyncIterable<number>]>(node, {
            refs,
          });
          if (initial) {
            root = value;
          }
        },
        onError: reject,
        onDone: resolve,
      });
    });
    const items: number[] = [];
    for await (const item of root![0]) {
      items.push(item);
    }
    for await (const item of root![1]) {
      items.push(item);
    }
    expect(items).toEqual([0, 1, 2, 0, 1]);
  });

  it('still serializes two async iterables to code', async () => {
    const chunks: string[] = [];
    await new Promise<void>((resolve, reject) => {
      crossSerializeStream([count(1), count(1)], {
        onSerialize(data) {
          chunks.push(data);
        },
        onError: reject,
        onDone: resolve,
      });
    });
    expect(chunks.length).toBeGreaterThan(1);
  });
});
