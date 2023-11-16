import { describe, it, expect } from 'vitest';
import {
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
} from '../../src';

const EXAMPLE_MESSAGE = 'This is an example message.';
const EXAMPLE_NAME = 'Example';
const EXAMPLE = new DOMException(EXAMPLE_MESSAGE, EXAMPLE_NAME);

describe('DOMException', () => {
  describe('serialize', () => {
    it('supports DOMException', () => {
      const result = serialize(EXAMPLE);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof EXAMPLE>(result);
      expect(back).toBeInstanceOf(DOMException);
      expect(back.message).toBe(EXAMPLE.message);
      expect(back.name).toBe(EXAMPLE.name);
    });
  });
  describe('serializeAsync', () => {
    it('supports DOMException', async () => {
      const result = await serializeAsync(Promise.resolve(EXAMPLE));
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(DOMException);
      expect(back.message).toBe(EXAMPLE.message);
      expect(back.name).toBe(EXAMPLE.name);
    });
  });
  describe('toJSON', () => {
    it('supports DOMException', () => {
      const result = toJSON(EXAMPLE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof EXAMPLE>(result);
      expect(back).toBeInstanceOf(DOMException);
      expect(back.message).toBe(EXAMPLE.message);
      expect(back.name).toBe(EXAMPLE.name);
    });
  });
  describe('toJSONAsync', () => {
    it('supports DOMException', async () => {
      const result = await toJSONAsync(Promise.resolve(EXAMPLE));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(DOMException);
      expect(back.message).toBe(EXAMPLE.message);
      expect(back.name).toBe(EXAMPLE.name);
    });
  });
  describe('crossSerialize', () => {
    it('supports DOMException', () => {
      const result = crossSerialize(EXAMPLE);
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports DOMException', () => {
        const result = crossSerialize(EXAMPLE, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports DOMException', async () => {
      const result = await crossSerializeAsync(Promise.resolve(EXAMPLE));
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports DOMException', async () => {
        const result = await crossSerializeAsync(Promise.resolve(EXAMPLE), { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports DOMException', async () => new Promise<void>((done) => {
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
      it('supports DOMException', async () => new Promise<void>((done) => {
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
    it('supports DOMException', () => {
      const result = toCrossJSON(EXAMPLE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof EXAMPLE>(result, {
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(DOMException);
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports DOMException', async () => {
      const example = Promise.resolve(EXAMPLE);
      const result = await toCrossJSONAsync(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromCrossJSON<typeof example>(result, {
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(DOMException);
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports DOMException', async () => new Promise<void>((done) => {
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
