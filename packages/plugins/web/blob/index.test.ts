import { describe, it, expect } from 'vitest';
import {
  crossSerializeAsync,
  deserialize,
  fromCrossJSON,
  fromJSON,
  serializeAsync,
  toCrossJSONAsync,
  toJSONAsync,
} from 'seroval';
import BlobPlugin from '.';

const EXAMPLE = new Blob(['Hello World'], {
  type: 'text/plain',
});
describe('Blob', () => {
  describe('serializeAsync', () => {
    it('supports Blob', async () => {
      const result = await serializeAsync(EXAMPLE, {
        plugins: [BlobPlugin],
      });
      expect(result).toMatchSnapshot();
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
      expect(JSON.stringify(result)).toMatchSnapshot();
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
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports Blob', async () => {
        const result = await crossSerializeAsync(Promise.resolve(EXAMPLE), {
          plugins: [BlobPlugin],
          scopeId: 'example',
        });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports Blob', async () => {
      const result = await toCrossJSONAsync(EXAMPLE, {
        plugins: [BlobPlugin],
      });
      expect(JSON.stringify(result)).toMatchSnapshot();
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
