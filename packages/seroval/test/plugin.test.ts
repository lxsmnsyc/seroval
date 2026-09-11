import { describe, expect, it } from 'vitest';
import type { SerovalNode } from '../src';
import {
  createPlugin,
  crossSerialize,
  crossSerializeAsync,
  crossSerializeStream,
  deserialize,
  fromCrossJSON,
  fromJSON,
  resolvePlugins,
  serialize,
  serializeAsync,
  toCrossJSON,
  toCrossJSONAsync,
  toCrossJSONStream,
  toJSON,
  toJSONAsync,
} from '../src';

const BufferPlugin = createPlugin<Buffer, SerovalNode>({
  tag: 'Buffer',
  test(value) {
    return value instanceof Buffer;
  },
  parse: {
    sync(value, ctx) {
      return ctx.parse(value.toString('base64'));
    },
    async async(value, ctx) {
      return await ctx.parse(value.toString('base64'));
    },
    stream(value, ctx) {
      return ctx.parse(value.toString('base64'));
    },
  },
  serialize(node, ctx) {
    return `Buffer.from(${ctx.serialize(node)}, "base64")`;
  },
  deserialize(node, ctx) {
    return Buffer.from(ctx.deserialize(node) as string, 'base64');
  },
});

const EXAMPLE = Buffer.from('Hello, World!', 'utf-8');

describe('Plugin', () => {
  describe('resolution', () => {
    it('keeps the input list independent of the resolved result', () => {
      const plugins = [BufferPlugin];
      const resolved = resolvePlugins(plugins);
      expect(resolved).toEqual([BufferPlugin]);
      resolved?.pop();
      expect(plugins).toEqual([BufferPlugin]);
      expect(resolvePlugins(plugins)).toEqual([BufferPlugin]);
    });

    it('keeps empty input lists independent of the resolved result', () => {
      const plugins: (typeof BufferPlugin)[] = [];
      const resolved = resolvePlugins(plugins);
      expect(resolved).toEqual([]);
      resolved?.push(BufferPlugin);
      expect(plugins).toEqual([]);
      expect(resolvePlugins()).toBeUndefined();
    });

    it('preserves dependency order and removes repeated plugin instances', () => {
      const parent = createPlugin({
        ...BufferPlugin,
        tag: 'parent',
        extends: [BufferPlugin],
      });
      const sibling = createPlugin({ ...BufferPlugin, tag: 'sibling' });
      expect(resolvePlugins([parent, sibling, BufferPlugin, parent])).toEqual([
        parent,
        BufferPlugin,
        sibling,
      ]);
    });

    it('observes dependencies added between resolutions and handles cycles', () => {
      const dependencies: (typeof BufferPlugin)[] = [];
      const parent = createPlugin({
        ...BufferPlugin,
        tag: 'parent',
        extends: dependencies,
      });
      expect(resolvePlugins([parent])).toEqual([parent]);
      dependencies.push(BufferPlugin, parent);
      expect(resolvePlugins([parent])).toEqual([parent, BufferPlugin]);
    });
  });
  describe('serialize', () => {
    it('supports Plugin', () => {
      const result = serialize(EXAMPLE, {
        plugins: [BufferPlugin],
      });
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof EXAMPLE>(result);
      expect(back).toBeInstanceOf(Buffer);
      expect(back.toString('utf-8')).toBe(EXAMPLE.toString('utf-8'));
    });
  });
  describe('serializeAsync', () => {
    it('supports Plugin', async () => {
      const result = await serializeAsync(Promise.resolve(EXAMPLE), {
        plugins: [BufferPlugin],
      });
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(Buffer);
      expect(back.toString('utf-8')).toBe(EXAMPLE.toString('utf-8'));
    });
  });
  describe('toJSON', () => {
    it('supports Plugin', () => {
      const result = toJSON(EXAMPLE, {
        plugins: [BufferPlugin],
      });

      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof EXAMPLE>(result, {
        plugins: [BufferPlugin],
      });
      expect(back).toBeInstanceOf(Buffer);
      expect(back.toString('utf-8')).toBe(EXAMPLE.toString('utf-8'));
    });
  });
  describe('toJSONAsync', () => {
    it('supports Plugin', async () => {
      const result = await toJSONAsync(Promise.resolve(EXAMPLE), {
        plugins: [BufferPlugin],
      });
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<typeof EXAMPLE>>(result, {
        plugins: [BufferPlugin],
      });
      expect(back).toBeInstanceOf(Buffer);
      expect(back.toString('utf-8')).toBe(EXAMPLE.toString('utf-8'));
    });
  });
  describe('crossSerialize', () => {
    it('supports Plugin', () => {
      const result = crossSerialize(EXAMPLE, {
        plugins: [BufferPlugin],
      });
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports Plugin', () => {
        const result = crossSerialize(EXAMPLE, {
          scopeId: 'example',
          plugins: [BufferPlugin],
        });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports Plugin', async () => {
      const result = await crossSerializeAsync(Promise.resolve(EXAMPLE), {
        plugins: [BufferPlugin],
      });
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports Plugin', async () => {
        const result = await crossSerializeAsync(Promise.resolve(EXAMPLE), {
          scopeId: 'example',
          plugins: [BufferPlugin],
        });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports Plugin', async () =>
      new Promise<void>((resolve, reject) => {
        crossSerializeStream(EXAMPLE, {
          plugins: [BufferPlugin],
          onSerialize(data) {
            expect(data).toMatchSnapshot();
          },
          onDone() {
            resolve();
          },
          onError(error) {
            reject(error);
          },
        });
      }));

    describe('scoped', () => {
      it('supports Plugin', async () =>
        new Promise<void>((resolve, reject) => {
          crossSerializeStream(EXAMPLE, {
            scopeId: 'example',
            plugins: [BufferPlugin],
            onSerialize(data) {
              expect(data).toMatchSnapshot();
            },
            onDone() {
              resolve();
            },
            onError(error) {
              reject(error);
            },
          });
        }));
    });
  });
  describe('toCrossJSON', () => {
    it('supports Plugin', () => {
      const result = toCrossJSON(EXAMPLE, {
        plugins: [BufferPlugin],
      });

      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof EXAMPLE>(result, {
        plugins: [BufferPlugin],
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(Buffer);
      expect(back.toString('utf-8')).toBe(EXAMPLE.toString('utf-8'));
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports Plugin', async () => {
      const result = await toCrossJSONAsync(Promise.resolve(EXAMPLE), {
        plugins: [BufferPlugin],
      });
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromCrossJSON<Promise<typeof EXAMPLE>>(result, {
        plugins: [BufferPlugin],
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(Buffer);
      expect(back.toString('utf-8')).toBe(EXAMPLE.toString('utf-8'));
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports Plugin', async () =>
      new Promise<void>((resolve, reject) => {
        toCrossJSONStream(EXAMPLE, {
          plugins: [BufferPlugin],
          onParse(data) {
            expect(JSON.stringify(data)).toMatchSnapshot();
          },
          onDone() {
            resolve();
          },
          onError(error) {
            reject(error);
          },
        });
      }));
  });
});
