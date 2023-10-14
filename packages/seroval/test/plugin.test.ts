import { describe, expect, it } from 'vitest';
import type { SerovalNode } from '../src';
import {
  createPlugin,
  serialize,
  deserialize,
  toJSON,
  fromJSON,
  toJSONAsync,
  crossSerialize,
  serializeAsync,
  crossSerializeAsync,
  crossSerializeStream,
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
      return ctx.parse(value.toString('base64'));
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
  describe('serialize', () => {
    it('supports Plugin', () => {
      const result = serialize(EXAMPLE, {
        plugins: [BufferPlugin],
      });

      expect(result).toMatchSnapshot();
      const back = deserialize<Buffer>(result);
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
      const back = await deserialize<Promise<Buffer>>(result);
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
      const back = fromJSON<Buffer>(result, {
        plugins: [BufferPlugin],
      });
      expect(back).toBeInstanceOf(Buffer);
      expect(back.toString('utf-8')).toBe(EXAMPLE.toString('utf-8'));
    });
  });
  describe('serializeAsync', () => {
    it('supports Plugin', async () => {
      const result = await toJSONAsync(Promise.resolve(EXAMPLE), {
        plugins: [BufferPlugin],
      });

      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<Buffer>>(result, {
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
    it('supports Plugin', async () => new Promise<void>((done) => {
      crossSerializeStream(EXAMPLE, {
        plugins: [BufferPlugin],
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));

    describe('scoped', () => {
      it('supports Plugin', async () => new Promise<void>((done) => {
        crossSerializeStream(EXAMPLE, {
          scopeId: 'example',
          plugins: [BufferPlugin],
          onSerialize(data) {
            expect(data).toMatchSnapshot();
          },
          onDone() {
            done();
          },
        });
      }));
    });
  });
});
