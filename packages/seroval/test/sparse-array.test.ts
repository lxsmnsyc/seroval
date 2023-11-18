import { describe, it, expect } from 'vitest';
import {
  deserialize,
  fromJSON,
  serialize,
  serializeAsync,
  toJSONAsync,
  toJSON,
  crossSerialize,
  crossSerializeAsync,
  crossSerializeStream,
  toCrossJSON,
  fromCrossJSON,
  toCrossJSONAsync,
  toCrossJSONStream,
} from '../src';

const EXAMPLE = new Array(10);

describe('sparse arrays', () => {
  describe('serialize', () => {
    it('supports sparse arrays', () => {
      const result = serialize(EXAMPLE);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof EXAMPLE>(result);
      expect(0 in back).toBeFalsy();
      expect(back[0]).toBe(undefined);
      expect(back.length).toBe(EXAMPLE.length);
    });
  });
  describe('serializeAsync', () => {
    it('supports sparse arrays', async () => {
      const result = await serializeAsync(Promise.resolve(EXAMPLE));
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<typeof EXAMPLE>>(result);
      expect(0 in back).toBeFalsy();
      expect(back[0]).toBe(undefined);
      expect(back.length).toBe(EXAMPLE.length);
    });
  });
  describe('toJSON', () => {
    it('supports sparse arrays', () => {
      const result = toJSON(EXAMPLE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof EXAMPLE>(result);
      expect(0 in back).toBeFalsy();
      expect(back[0]).toBe(undefined);
      expect(back.length).toBe(EXAMPLE.length);
    });
  });
  describe('toJSONAsync', () => {
    it('supports sparse arrays', async () => {
      const result = await toJSONAsync(Promise.resolve(EXAMPLE));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<typeof EXAMPLE>>(result);
      expect(0 in back).toBeFalsy();
      expect(back[0]).toBe(undefined);
      expect(back.length).toBe(EXAMPLE.length);
    });
  });
  describe('crossSerialize', () => {
    it('supports sparse arrays', () => {
      const result = crossSerialize(EXAMPLE);
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports sparse arrays', () => {
        const result = crossSerialize(EXAMPLE, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports sparse arrays', async () => {
      const result = await crossSerializeAsync(Promise.resolve(EXAMPLE));
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports sparse arrays', async () => {
        const result = await crossSerializeAsync(Promise.resolve(EXAMPLE), { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports sparse arrays', async () => new Promise<void>((resolve, reject) => {
      crossSerializeStream(Promise.resolve(EXAMPLE), {
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
      it('supports sparse arrays', async () => new Promise<void>((resolve, reject) => {
        crossSerializeStream(Promise.resolve(EXAMPLE), {
          scopeId: 'example',
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
    it('supports sparse arrays', () => {
      const result = toCrossJSON(EXAMPLE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof EXAMPLE>(result, {
        refs: new Map(),
      });
      expect(0 in back).toBeFalsy();
      expect(back[0]).toBe(undefined);
      expect(back.length).toBe(EXAMPLE.length);
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports sparse arrays', async () => {
      const result = await toCrossJSONAsync(Promise.resolve(EXAMPLE));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromCrossJSON<Promise<typeof EXAMPLE>>(result, {
        refs: new Map(),
      });
      expect(0 in back).toBeFalsy();
      expect(back[0]).toBe(undefined);
      expect(back.length).toBe(EXAMPLE.length);
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports sparse arrays', async () => new Promise<void>((resolve, reject) => {
      toCrossJSONStream(Promise.resolve(EXAMPLE), {
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
