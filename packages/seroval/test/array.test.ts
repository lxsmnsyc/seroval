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
  toCrossJSONStream,
  toCrossJSONAsync,
  fromCrossJSON,
  toCrossJSON,
} from '../src';

const EXAMPLE = [1, 2, 3];

const RECURSIVE_EXAMPLE: unknown[] = [];
RECURSIVE_EXAMPLE[0] = RECURSIVE_EXAMPLE;
RECURSIVE_EXAMPLE[1] = RECURSIVE_EXAMPLE;

const ASYNC_RECURSIVE_EXAMPLE: Promise<unknown>[] = [];
ASYNC_RECURSIVE_EXAMPLE[0] = Promise.resolve(ASYNC_RECURSIVE_EXAMPLE);
ASYNC_RECURSIVE_EXAMPLE[1] = Promise.resolve(ASYNC_RECURSIVE_EXAMPLE);

describe('arrays', () => {
  describe('serialize', () => {
    it('supports Arrays', () => {
      const result = serialize(EXAMPLE);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof EXAMPLE>(result);
      expect(back).toBeInstanceOf(Array);
      expect(back[0]).toBe(EXAMPLE[0]);
      expect(back[1]).toBe(EXAMPLE[1]);
      expect(back[2]).toBe(EXAMPLE[2]);
    });
    it('supports self recursion', () => {
      const result = serialize(RECURSIVE_EXAMPLE);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof RECURSIVE_EXAMPLE>(result);
      expect(back[0]).toBe(back);
      expect(back[1]).toBe(back);
    });
  });
  describe('serializeAsync', () => {
    it('supports Arrays', async () => {
      const result = await serializeAsync(Promise.resolve(EXAMPLE));
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(Array);
      expect(back[0]).toBe(EXAMPLE[0]);
      expect(back[1]).toBe(EXAMPLE[1]);
      expect(back[2]).toBe(EXAMPLE[2]);
    });
    it('supports self recursion', async () => {
      const example: Promise<unknown>[] = [];
      example[0] = Promise.resolve(example);
      example[1] = Promise.resolve(example);
      const result = await serializeAsync(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof example>(result);
      expect(await back[0]).toBe(back);
      expect(await back[1]).toBe(back);
    });
  });
  describe('toJSON', () => {
    it('supports Arrays', () => {
      const result = toJSON(EXAMPLE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof EXAMPLE>(result);
      expect(back).toBeInstanceOf(Array);
      expect(back[0]).toBe(EXAMPLE[0]);
      expect(back[1]).toBe(EXAMPLE[1]);
      expect(back[2]).toBe(EXAMPLE[2]);
    });
    it('supports self recursion', () => {
      const result = toJSON(RECURSIVE_EXAMPLE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof RECURSIVE_EXAMPLE>(result);
      expect(back[0]).toBe(back);
      expect(back[1]).toBe(back);
    });
  });
  describe('toJSONAsync', () => {
    it('supports Arrays', async () => {
      const result = await toJSONAsync(Promise.resolve(EXAMPLE));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(Array);
      expect(back[0]).toBe(EXAMPLE[0]);
      expect(back[1]).toBe(EXAMPLE[1]);
      expect(back[2]).toBe(EXAMPLE[2]);
    });
    it('supports self recursion', async () => {
      const result = await toJSONAsync(ASYNC_RECURSIVE_EXAMPLE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof ASYNC_RECURSIVE_EXAMPLE>(result);
      expect(await back[0]).toBe(back);
      expect(await back[1]).toBe(back);
    });
  });
  describe('crossSerialize', () => {
    it('supports Arrays', () => {
      const result = crossSerialize(EXAMPLE);
      expect(result).toMatchSnapshot();
    });
    it('supports self recursion', () => {
      const result = crossSerialize(RECURSIVE_EXAMPLE);
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports Arrays', () => {
        const result = crossSerialize(EXAMPLE, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
      it('supports self recursion', () => {
        const result = crossSerialize(RECURSIVE_EXAMPLE, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports Arrays', async () => {
      const result = await crossSerializeAsync(Promise.resolve(EXAMPLE));
      expect(result).toMatchSnapshot();
    });
    it('supports self recursion', async () => {
      const result = await crossSerializeAsync(ASYNC_RECURSIVE_EXAMPLE);
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports Arrays', async () => {
        const result = await crossSerializeAsync(Promise.resolve(EXAMPLE), { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
      it('supports self recursion', async () => {
        const result = await crossSerializeAsync(ASYNC_RECURSIVE_EXAMPLE, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports Arrays', async () => new Promise<void>((done) => {
      crossSerializeStream(Promise.resolve(EXAMPLE), {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    it('supports self recursion', async () => new Promise<void>((done) => {
      crossSerializeStream(ASYNC_RECURSIVE_EXAMPLE, {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    describe('scoped', () => {
      it('supports Arrays', async () => new Promise<void>((done) => {
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
      it('supports self recursion', async () => new Promise<void>((done) => {
        crossSerializeStream(ASYNC_RECURSIVE_EXAMPLE, {
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
    it('supports Arrays', () => {
      const result = toCrossJSON(EXAMPLE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof EXAMPLE>(result, {
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(Array);
      expect(back[0]).toBe(EXAMPLE[0]);
      expect(back[1]).toBe(EXAMPLE[1]);
      expect(back[2]).toBe(EXAMPLE[2]);
    });
    it('supports self recursion', () => {
      const result = toCrossJSON(RECURSIVE_EXAMPLE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof RECURSIVE_EXAMPLE>(result, {
        refs: new Map(),
      });
      expect(back[0]).toBe(back);
      expect(back[1]).toBe(back);
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports Arrays', async () => {
      const result = await toCrossJSONAsync(Promise.resolve(EXAMPLE));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromCrossJSON<Promise<typeof EXAMPLE>>(result, {
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(Array);
      expect(back[0]).toBe(EXAMPLE[0]);
      expect(back[1]).toBe(EXAMPLE[1]);
      expect(back[2]).toBe(EXAMPLE[2]);
    });
    it('supports self recursion', async () => {
      const result = await toCrossJSONAsync(ASYNC_RECURSIVE_EXAMPLE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof ASYNC_RECURSIVE_EXAMPLE>(result, {
        refs: new Map(),
      });
      expect(await back[0]).toBe(back);
      expect(await back[1]).toBe(back);
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports Arrays', async () => new Promise<void>((done) => {
      toCrossJSONStream(Promise.resolve(EXAMPLE), {
        onParse(data) {
          expect(JSON.stringify(data)).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    it('supports self recursion', async () => new Promise<void>((done) => {
      toCrossJSONStream(ASYNC_RECURSIVE_EXAMPLE, {
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
