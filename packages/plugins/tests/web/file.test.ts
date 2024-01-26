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
import FilePlugin from '../../web/file';

const EXAMPLE = new File(['Hello World'], 'hello.txt', {
  type: 'text/plain',
  lastModified: 1681027542680,
});

describe('File', () => {
  describe('serializeAsync', () => {
    it('supports File', async () => {
      const result = await serializeAsync(EXAMPLE, {
        plugins: [FilePlugin],
      });
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof EXAMPLE>(result);
      expect(back).toBeInstanceOf(File);
      expect(await back.text()).toBe(await EXAMPLE.text());
      expect(back.type).toBe(EXAMPLE.type);
    });
  });
  describe('toJSONAsync', () => {
    it('supports File', async () => {
      const result = await toJSONAsync(EXAMPLE, {
        plugins: [FilePlugin],
      });
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof EXAMPLE>(result, {
        plugins: [FilePlugin],
      });
      expect(back).toBeInstanceOf(File);
      expect(await back.text()).toBe(await EXAMPLE.text());
      expect(back.type).toBe(EXAMPLE.type);
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports File', async () => {
      const result = await crossSerializeAsync(EXAMPLE, {
        plugins: [FilePlugin],
      });
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports File', async () => {
        const result = await crossSerializeAsync(EXAMPLE, {
          plugins: [FilePlugin],
          scopeId: 'example',
        });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports File', async () => {
      const result = await toCrossJSONAsync(EXAMPLE, {
        plugins: [FilePlugin],
      });
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof EXAMPLE>(result, {
        plugins: [FilePlugin],
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(File);
      expect(await back.text()).toBe(await EXAMPLE.text());
      expect(back.type).toBe(EXAMPLE.type);
    });
  });
});
