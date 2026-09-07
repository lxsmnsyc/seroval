import {
  crossSerializeAsync,
  deserialize,
  fromCrossJSON,
  fromJSON,
  serializeAsync,
  SerovalPluginValidationError,
  type SerovalNode,
  toCrossJSONAsync,
  toJSON,
  toJSONAsync,
} from 'seroval';
import { describe, expect, it } from 'vitest';
import BlobPlugin from '../../web/blob';

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
  describe('validation', () => {
    it('rejects a Blob payload whose type field is not a string', async () => {
      const result = await toJSONAsync(EXAMPLE, { plugins: [BlobPlugin] });
      // Aim the `type` field at a number node so the `v.string` guard trips.
      (result.t as unknown as { s: Record<string, SerovalNode> }).s.type =
        toJSON(42).t;
      let caught: unknown;
      try {
        fromJSON(result, { plugins: [BlobPlugin] });
      } catch (error) {
        caught = error;
      }
      expect((caught as { cause: unknown }).cause).toBeInstanceOf(
        SerovalPluginValidationError,
      );
    });
  });
});
