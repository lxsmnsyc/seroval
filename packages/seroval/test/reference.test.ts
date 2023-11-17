import { describe, it, expect } from 'vitest';
import {
  createReference,
  crossSerialize,
  crossSerializeAsync,
  crossSerializeStream,
  deserialize,
  fromCrossJSON,
  fromJSON,
  serialize,
  serializeAsync,
  toCrossJSON,
  toCrossJSONAsync,
  toCrossJSONStream,
  toJSON,
  toJSONAsync,
} from '../src';

const EXAMPLE = createReference('example', () => 'Hello World');

describe('Reference', () => {
  describe('serialize', () => {
    it('supports Reference', () => {
      const result = serialize(EXAMPLE);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof EXAMPLE>(result);
      expect(back).toBe(EXAMPLE);
    });
  });
  describe('serializeAsync', () => {
    it('supports Reference', async () => {
      const result = await serializeAsync(Promise.resolve(EXAMPLE));
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<typeof EXAMPLE>>(result);
      expect(back).toBe(EXAMPLE);
    });
  });
  describe('toJSON', () => {
    it('supports Reference', () => {
      const result = toJSON(EXAMPLE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof EXAMPLE>(result);
      expect(back).toBe(EXAMPLE);
    });
  });
  describe('toJSONAsync', () => {
    it('supports Reference', async () => {
      const result = await toJSONAsync(Promise.resolve(EXAMPLE));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<typeof EXAMPLE>>(result);
      expect(back).toBe(EXAMPLE);
    });
  });
  describe('crossSerialize', () => {
    it('supports Reference', () => {
      const result = crossSerialize(EXAMPLE);
      expect(result).toMatchSnapshot();
    });
    describe('crossSerialize', () => {
      it('supports Reference', () => {
        const result = crossSerialize(EXAMPLE, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports Reference', async () => {
      const result = await crossSerializeAsync(Promise.resolve(EXAMPLE));
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports Reference', async () => {
        const result = await crossSerializeAsync(Promise.resolve(EXAMPLE), { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports Reference', async () => new Promise<void>((done) => {
      crossSerializeStream(Promise.resolve(EXAMPLE), {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    describe('scoped', () => {
      it('supports Reference', async () => new Promise<void>((done) => {
        crossSerializeStream(Promise.resolve(EXAMPLE), {
          scopeId: 'example',
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
  describe('toCrossJSON', () => {
    it('supports Reference', () => {
      const result = toCrossJSON(EXAMPLE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof EXAMPLE>(result, {
        refs: new Map(),
      });
      expect(back).toBe(EXAMPLE);
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports Reference', async () => {
      const result = await toCrossJSONAsync(Promise.resolve(EXAMPLE));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromCrossJSON<Promise<typeof EXAMPLE>>(result, {
        refs: new Map(),
      });
      expect(back).toBe(EXAMPLE);
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports Reference', async () => new Promise<void>((done) => {
      toCrossJSONStream(Promise.resolve(EXAMPLE), {
        onParse(data) {
          expect(JSON.stringify(data)).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
  });
});
