import { describe, expect, it } from 'vitest';
import type { SerovalNode } from '../src';
import {
  createPlugin,
  crossSerialize,
  crossSerializeAsync,
  deserialize,
  fromCrossJSON,
  fromJSON,
  serialize,
  serializeAsync,
  toCrossJSON,
  toCrossJSONAsync,
  toJSON,
  toJSONAsync,
} from '../src';
import { evaluateCross, streamCross, streamCrossJSON } from './utils/cross';

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
    return Buffer.from(ctx.deserialize(node), 'base64');
  },
});

const EXAMPLE = Buffer.from('Hello, World!', 'utf-8');

describe('Plugin', () => {
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
      const back = await evaluateCross<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(Buffer);
      expect(back.toString('utf-8')).toBe(EXAMPLE.toString('utf-8'));
    });
    describe('scoped', () => {
      it('supports Plugin', async () => {
        const result = await crossSerializeAsync(Promise.resolve(EXAMPLE), {
          scopeId: 'example',
          plugins: [BufferPlugin],
        });
        const back = await evaluateCross<Promise<typeof EXAMPLE>>(result, 'example');
        expect(back).toBeInstanceOf(Buffer);
        expect(back.toString('utf-8')).toBe(EXAMPLE.toString('utf-8'));
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports Plugin', async () => {
      const back = await streamCross<typeof EXAMPLE>(EXAMPLE, {
        plugins: [BufferPlugin],
      });
      expect(back).toBeInstanceOf(Buffer);
      expect(back.toString('utf-8')).toBe(EXAMPLE.toString('utf-8'));
    });
    describe('scoped', () => {
      it('supports Plugin', async () => {
        const back = await streamCross<typeof EXAMPLE>(EXAMPLE, {
          scopeId: 'example',
          plugins: [BufferPlugin],
        });
        expect(back).toBeInstanceOf(Buffer);
        expect(back.toString('utf-8')).toBe(EXAMPLE.toString('utf-8'));
      });
    });
  });
  describe('toCrossJSON', () => {
    it('supports Plugin', () => {
      const result = toCrossJSON(EXAMPLE, {
        plugins: [BufferPlugin],
      });

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
      const back = await fromCrossJSON<Promise<typeof EXAMPLE>>(result, {
        plugins: [BufferPlugin],
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(Buffer);
      expect(back.toString('utf-8')).toBe(EXAMPLE.toString('utf-8'));
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports Plugin', async () => {
      const back = await streamCrossJSON<typeof EXAMPLE>(EXAMPLE, {
        plugins: [BufferPlugin],
      });
      expect(back).toBeInstanceOf(Buffer);
      expect(back.toString('utf-8')).toBe(EXAMPLE.toString('utf-8'));
    });
  });
});
