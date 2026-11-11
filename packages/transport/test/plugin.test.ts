import type { Plugin, SerovalNode } from 'seroval';
import { createPlugin } from 'seroval';
import { describe, expect, it } from 'vitest';
import type { Message, Reader } from '../src';
import { SerovalTransportError, createJSONReader, createJSONWriter } from '../src';

class Point {
  x: number;

  constructor(x: number) {
    this.x = x;
  }
}

const PointPlugin: Plugin<Point, { x: SerovalNode }> = createPlugin<Point, { x: SerovalNode }>({
  tag: 'transport/point',
  test(value) {
    return value instanceof Point;
  },
  parse: {
    sync: (value, ctx) => ({ x: ctx.parse(value.x) }),
    async: async (value, ctx) => ({ x: await ctx.parse(value.x) }),
    stream: (value, ctx) => ({ x: ctx.parse(value.x) }),
  },
  serialize: (node, ctx) => `new Point(${ctx.serialize(node.x)})`,
  deserialize: (node, ctx) => new Point(ctx.deserialize<number>(node.x)),
});

const plugins = [PointPlugin];

/** Sends each message through `structuredClone`, as `postMessage` does. */
function pipeTo(reader: Reader): (message: Message) => void {
  return (message) => {
    reader.push(structuredClone(message));
  };
}

async function* points(): AsyncGenerator<Point> {
  yield new Point(1);
  await Promise.resolve();
  yield new Point(2);
}

describe('Plugins', () => {
  it('decodes a plugin value in a value', async () => {
    const reader = createJSONReader({ plugins });
    const writer = createJSONWriter({ send: pipeTo(reader), plugins });
    writer.write('a', { point: new Point(1), later: Promise.resolve(new Point(2)) });
    const a = await reader.get<{ point: Point; later: Promise<Point> }>('a');
    expect(a.point).toBeInstanceOf(Point);
    expect(a.point.x).toBe(1);
    const later = await a.later;
    expect(later).toBeInstanceOf(Point);
    expect(later.x).toBe(2);
  });

  it('decodes a plugin value in a stream chunk', async () => {
    const reader = createJSONReader({ plugins });
    const writer = createJSONWriter({ send: pipeTo(reader), plugins });
    writer.write('a', { items: points() });
    const a = await reader.get<{ items: AsyncIterable<Point> }>('a');
    const received: Point[] = [];
    for await (const item of a.items) {
      received.push(item);
    }
    expect(received).toEqual([new Point(1), new Point(2)]);
    for (const item of received) {
      expect(item).toBeInstanceOf(Point);
    }
  });

  it('decodes a plugin value after a key is cancelled', async () => {
    const reader = createJSONReader({ plugins });
    const writer = createJSONWriter({ send: pipeTo(reader), plugins });
    writer.write('a', { point: new Point(1), later: new Promise<Point>(() => {}) });
    const a = await reader.get<{ point: Point; later: Promise<Point> }>('a');
    expect(a.point).toBeInstanceOf(Point);
    writer.cancel('a');
    await expect(a.later).rejects.toBeInstanceOf(SerovalTransportError);
    reader.cancel('a');
    writer.write('b', { point: new Point(3), later: Promise.resolve(new Point(4)) });
    const b = await reader.get<{ point: Point; later: Promise<Point> }>('b');
    expect(b.point).toBeInstanceOf(Point);
    expect(b.point.x).toBe(3);
    expect((await b.later).x).toBe(4);
  });
});
