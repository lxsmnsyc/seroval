import { describe, it, expect } from 'vitest';
import {
  crossSerialize,
  crossSerializeAsync,
  crossSerializeStream,
  deserialize,
  fromJSON,
  serialize,
  serializeAsync,
  toJSON,
  toJSONAsync,
} from '../../src';

const EXAMPLE_MESSAGE = 'This is an example message.';
const EXAMPLE_NAME = 'Example';

describe('DOMException', () => {
  describe('serialize', () => {
    it('supports DOMException', () => {
      const example = new DOMException(EXAMPLE_MESSAGE, EXAMPLE_NAME);
      const result = serialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<DOMException>(result);
      expect(back).toBeInstanceOf(DOMException);
      expect(back.message).toBe(example.message);
      expect(back.name).toBe(example.name);
    });
  });
  describe('serializeAsync', () => {
    it('supports DOMException', async () => {
      const example = new DOMException(EXAMPLE_MESSAGE, EXAMPLE_NAME);
      const result = await serializeAsync(Promise.resolve(example));
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<DOMException>>(result);
      expect(back).toBeInstanceOf(DOMException);
      expect(back.message).toBe(example.message);
      expect(back.name).toBe(example.name);
    });
  });
  describe('toJSON', () => {
    it('supports DOMException', () => {
      const example = new DOMException(EXAMPLE_MESSAGE, EXAMPLE_NAME);
      const result = toJSON(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<DOMException>(result);
      expect(back).toBeInstanceOf(DOMException);
      expect(back.message).toBe(example.message);
      expect(back.name).toBe(example.name);
    });
  });
  describe('toJSONAsync', () => {
    it('supports DOMException', async () => {
      const example = new DOMException(EXAMPLE_MESSAGE, EXAMPLE_NAME);
      const result = await toJSONAsync(Promise.resolve(example));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<DOMException>>(result);
      expect(back).toBeInstanceOf(DOMException);
      expect(back.message).toBe(example.message);
      expect(back.name).toBe(example.name);
    });
  });
  describe('crossSerialize', () => {
    it('supports DOMException', () => {
      const example = new DOMException(EXAMPLE_MESSAGE, EXAMPLE_NAME);
      const result = crossSerialize(example);
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports DOMException', () => {
        const example = new DOMException(EXAMPLE_MESSAGE, EXAMPLE_NAME);
        const result = crossSerialize(example, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports DOMException', async () => {
      const example = new DOMException(EXAMPLE_MESSAGE, EXAMPLE_NAME);
      const result = await crossSerializeAsync(Promise.resolve(example));
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports DOMException', async () => {
        const example = new DOMException(EXAMPLE_MESSAGE, EXAMPLE_NAME);
        const result = await crossSerializeAsync(Promise.resolve(example), { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports DOMException', async () => new Promise<void>((done) => {
      const example = new DOMException(EXAMPLE_MESSAGE, EXAMPLE_NAME);
      crossSerializeStream(Promise.resolve(example), {
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
        const example = new DOMException(EXAMPLE_MESSAGE, EXAMPLE_NAME);
        crossSerializeStream(Promise.resolve(example), {
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
});
