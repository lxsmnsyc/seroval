import {
  crossSerializeAsync,
  deserialize,
  fromCrossJSON,
  fromJSON,
  serializeAsync,
  toCrossJSONAsync,
  toJSONAsync,
} from 'seroval';
import { describe, expect, it } from 'vitest';
import BlobPlugin from '../../web/blob';
import { evaluateCross } from '../utils/cross';

const EXAMPLE = new Blob(['Hello World'], {
  type: 'text/plain',
});
describe('Blob', () => {
  describe('serializeAsync', () => {
    it('supports Blob', async () => {
      const result = await serializeAsync(EXAMPLE, {
        plugins: [BlobPlugin],
      });
      const back = deserialize<typeof EXAMPLE>(result);
      expect(back).toBeInstanceOf(Blob);
      expect(await back.text()).toBe(await EXAMPLE.text());
      expect(back.type).toBe(EXAMPLE.type);
    });
  });
  describe('toJSONAsync', () => {
    it('supports Blob', async () => {
      const result = await toJSONAsync(EXAMPLE, {
        plugins: [BlobPlugin],
      });
      const back = fromJSON<typeof EXAMPLE>(result, {
        plugins: [BlobPlugin],
      });
      expect(back).toBeInstanceOf(Blob);
      expect(await back.text()).toBe(await EXAMPLE.text());
      expect(back.type).toBe(EXAMPLE.type);
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports Blob', async () => {
      const result = await crossSerializeAsync(EXAMPLE, {
        plugins: [BlobPlugin],
      });
      const back = evaluateCross<typeof EXAMPLE>(result);
      expect(back).toBeInstanceOf(Blob);
      expect(await back.text()).toBe(await EXAMPLE.text());
      expect(back.type).toBe(EXAMPLE.type);
    });
    describe('scoped', () => {
      it('supports Blob', async () => {
        const result = await crossSerializeAsync(Promise.resolve(EXAMPLE), {
          plugins: [BlobPlugin],
          scopeId: 'example',
        });
        const back = await evaluateCross<Promise<typeof EXAMPLE>>(result, 'example');
        expect(back).toBeInstanceOf(Blob);
        expect(await back.text()).toBe(await EXAMPLE.text());
        expect(back.type).toBe(EXAMPLE.type);
      });
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports Blob', async () => {
      const result = await toCrossJSONAsync(EXAMPLE, {
        plugins: [BlobPlugin],
      });
      const back = fromCrossJSON<typeof EXAMPLE>(result, {
        plugins: [BlobPlugin],
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(Blob);
      expect(await back.text()).toBe(await EXAMPLE.text());
      expect(back.type).toBe(EXAMPLE.type);
    });
  });
});
