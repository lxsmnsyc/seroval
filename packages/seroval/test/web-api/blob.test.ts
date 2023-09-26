import { describe, it, expect } from 'vitest';
import 'node-fetch-native/polyfill';
import {
  crossSerializeAsync,
  deserialize,
  fromJSON,
  serializeAsync,
  toJSONAsync,
} from '../../src';

describe('Blob', () => {
  describe('serializeAsync', () => {
    it('supports Blob', async () => {
      const example = new Blob(['Hello World'], {
        type: 'text/plain',
      });
      const result = await serializeAsync(Promise.resolve(example));
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<Blob>>(result);
      expect(back).toBeInstanceOf(Blob);
      expect(await back.text()).toBe(await example.text());
      expect(back.type).toBe(example.type);
    });
  });
  describe('toJSONAsync', () => {
    it('supports Blob', async () => {
      const example = new Blob(['Hello World'], {
        type: 'text/plain',
      });
      const result = await toJSONAsync(Promise.resolve(example));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<Blob>>(result);
      expect(back).toBeInstanceOf(Blob);
      expect(await back.text()).toBe(await example.text());
      expect(back.type).toBe(example.type);
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports Blob', async () => {
      const example = new Blob(['Hello World'], {
        type: 'text/plain',
      });
      const result = await crossSerializeAsync(Promise.resolve(example));
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports Blob', async () => {
        const example = new Blob(['Hello World'], {
          type: 'text/plain',
        });
        const result = await crossSerializeAsync(Promise.resolve(example), { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
});
