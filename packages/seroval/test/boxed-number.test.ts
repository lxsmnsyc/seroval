import { describe, expect, it } from 'vitest';
import {
  crossSerialize,
  crossSerializeAsync,
  fromCrossJSON,
  fromJSON,
  serialize,
  serializeAsync,
  toCrossJSON,
  toCrossJSONAsync,
  toJSON,
  toJSONAsync,
} from '../src';
import { evaluateCross, streamCross, streamCrossJSON } from './utils/cross';

describe('boxed number', () => {
  describe('serialize', () => {
    it('supports boxed numbers', () => {
      const value = 0xdeadbeef;
      expect(serialize(Object(value))).toBe(`Object(${value})`);
      expect(serialize(Object(Number.NaN))).toBe('Object(0/0)');
      expect(serialize(Object(Number.POSITIVE_INFINITY))).toBe('Object(1/0)');
      expect(serialize(Object(Number.NEGATIVE_INFINITY))).toBe('Object(-1/0)');
      expect(serialize(Object(-0))).toBe('Object(-0)');
    });
  });
  describe('serializeAsync', () => {
    it('supports boxed numbers', async () => {
      const value = 0xdeadbeef;
      expect(await serializeAsync(Promise.resolve(Object(value)))).toBe(
        `Promise.resolve(Object(${value}))`,
      );
      expect(await serializeAsync(Promise.resolve(Object(Number.NaN)))).toBe(
        'Promise.resolve(Object(0/0))',
      );
      expect(
        await serializeAsync(Promise.resolve(Object(Number.POSITIVE_INFINITY))),
      ).toBe('Promise.resolve(Object(1/0))');
      expect(
        await serializeAsync(Promise.resolve(Object(Number.NEGATIVE_INFINITY))),
      ).toBe('Promise.resolve(Object(-1/0))');
      expect(await serializeAsync(Promise.resolve(Object(-0)))).toBe(
        'Promise.resolve(Object(-0))',
      );
    });
  });
  describe('toJSON', () => {
    it('supports boxed numbers', () => {
      {
        const back = fromJSON<Number>(toJSON(Object(0xdeadbeef)));
        expect(back).toBeInstanceOf(Number);
        expect(back.valueOf()).toBe(0xdeadbeef);
      }
      {
        const back = fromJSON<Number>(toJSON(Object(Number.NaN)));
        expect(back).toBeInstanceOf(Number);
        expect(back.valueOf()).toBe(Number.NaN);
      }
      {
        const back = fromJSON<Number>(toJSON(Object(Number.POSITIVE_INFINITY)));
        expect(back).toBeInstanceOf(Number);
        expect(back.valueOf()).toBe(Number.POSITIVE_INFINITY);
      }
      {
        const back = fromJSON<Number>(toJSON(Object(Number.NEGATIVE_INFINITY)));
        expect(back).toBeInstanceOf(Number);
        expect(back.valueOf()).toBe(Number.NEGATIVE_INFINITY);
      }
      {
        const back = fromJSON<Number>(toJSON(Object(-0)));
        expect(back).toBeInstanceOf(Number);
        expect(back.valueOf()).toBe(-0);
      }
    });
  });
  describe('toJSONAsync', () => {
    it('supports boxed numbers', async () => {
      {
        const back = await fromJSON<Promise<Number>>(await toJSONAsync(Promise.resolve(Object(0xdeadbeef))));
        expect(back).toBeInstanceOf(Number);
        expect(back.valueOf()).toBe(0xdeadbeef);
      }
      {
        const back = await fromJSON<Promise<Number>>(await toJSONAsync(Promise.resolve(Object(Number.NaN))));
        expect(back).toBeInstanceOf(Number);
        expect(back.valueOf()).toBe(Number.NaN);
      }
      {
        const back = await fromJSON<Promise<Number>>(await toJSONAsync(Promise.resolve(Object(Number.POSITIVE_INFINITY))));
        expect(back).toBeInstanceOf(Number);
        expect(back.valueOf()).toBe(Number.POSITIVE_INFINITY);
      }
      {
        const back = await fromJSON<Promise<Number>>(await toJSONAsync(Promise.resolve(Object(Number.NEGATIVE_INFINITY))));
        expect(back).toBeInstanceOf(Number);
        expect(back.valueOf()).toBe(Number.NEGATIVE_INFINITY);
      }
      {
        const back = await fromJSON<Promise<Number>>(await toJSONAsync(Promise.resolve(Object(-0))));
        expect(back).toBeInstanceOf(Number);
        expect(back.valueOf()).toBe(-0);
      }
    });
  });
  describe('crossSerialize', () => {
    it('supports boxed numbers', () => {
      const value = 0xdeadbeef;
      expect(crossSerialize(Object(value))).toMatchSnapshot();
      expect(crossSerialize(Object(Number.NaN))).toMatchSnapshot();
      expect(
        crossSerialize(Object(Number.POSITIVE_INFINITY)),
      ).toMatchSnapshot();
      expect(
        crossSerialize(Object(Number.NEGATIVE_INFINITY)),
      ).toMatchSnapshot();
      expect(crossSerialize(Object(-0))).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports boxed numbers', () => {
        const value = 0xdeadbeef;
        expect(
          crossSerialize(Object(value), { scopeId: 'example' }),
        ).toMatchSnapshot();
        expect(
          crossSerialize(Object(Number.NaN), { scopeId: 'example' }),
        ).toMatchSnapshot();
        expect(
          crossSerialize(Object(Number.POSITIVE_INFINITY), {
            scopeId: 'example',
          }),
        ).toMatchSnapshot();
        expect(
          crossSerialize(Object(Number.NEGATIVE_INFINITY), {
            scopeId: 'example',
          }),
        ).toMatchSnapshot();
        expect(
          crossSerialize(Object(-0), { scopeId: 'example' }),
        ).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports boxed numbers', async () => {
      {
        const back = await evaluateCross<Promise<Number>>(await crossSerializeAsync(Promise.resolve(Object(0xdeadbeef))));
        expect(back).toBeInstanceOf(Number);
        expect(back.valueOf()).toBe(0xdeadbeef);
      }
      {
        const back = await evaluateCross<Promise<Number>>(await crossSerializeAsync(Promise.resolve(Object(Number.NaN))));
        expect(back).toBeInstanceOf(Number);
        expect(back.valueOf()).toBe(Number.NaN);
      }
      {
        const back = await evaluateCross<Promise<Number>>(await crossSerializeAsync(Promise.resolve(Object(Number.POSITIVE_INFINITY))));
        expect(back).toBeInstanceOf(Number);
        expect(back.valueOf()).toBe(Number.POSITIVE_INFINITY);
      }
      {
        const back = await evaluateCross<Promise<Number>>(await crossSerializeAsync(Promise.resolve(Object(Number.NEGATIVE_INFINITY))));
        expect(back).toBeInstanceOf(Number);
        expect(back.valueOf()).toBe(Number.NEGATIVE_INFINITY);
      }
      {
        const back = await evaluateCross<Promise<Number>>(await crossSerializeAsync(Promise.resolve(Object(-0))));
        expect(back).toBeInstanceOf(Number);
        expect(back.valueOf()).toBe(-0);
      }
    });
    describe('scoped', () => {
      it('supports boxed numbers', async () => {
        {
          const back = await evaluateCross<Promise<Number>>(
            await crossSerializeAsync(Promise.resolve(Object(0xdeadbeef)), { scopeId: 'example' }),
            'example',
          );
          expect(back).toBeInstanceOf(Number);
          expect(back.valueOf()).toBe(0xdeadbeef);
        }
        {
          const back = await evaluateCross<Promise<Number>>(
            await crossSerializeAsync(Promise.resolve(Object(Number.NaN)), { scopeId: 'example' }),
            'example',
          );
          expect(back).toBeInstanceOf(Number);
          expect(back.valueOf()).toBe(Number.NaN);
        }
        {
          const back = await evaluateCross<Promise<Number>>(
            await crossSerializeAsync(Promise.resolve(Object(Number.POSITIVE_INFINITY)), { scopeId: 'example' }),
            'example',
          );
          expect(back).toBeInstanceOf(Number);
          expect(back.valueOf()).toBe(Number.POSITIVE_INFINITY);
        }
        {
          const back = await evaluateCross<Promise<Number>>(
            await crossSerializeAsync(Promise.resolve(Object(Number.NEGATIVE_INFINITY)), { scopeId: 'example' }),
            'example',
          );
          expect(back).toBeInstanceOf(Number);
          expect(back.valueOf()).toBe(Number.NEGATIVE_INFINITY);
        }
        {
          const back = await evaluateCross<Promise<Number>>(
            await crossSerializeAsync(Promise.resolve(Object(-0)), { scopeId: 'example' }),
            'example',
          );
          expect(back).toBeInstanceOf(Number);
          expect(back.valueOf()).toBe(-0);
        }
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports boxed numbers', async () => {
      const back = await streamCross<Promise<Number>>(Promise.resolve(Object(0xdeadbeef)));
      expect(back).toBeInstanceOf(Number);
      expect(back.valueOf()).toBe(0xdeadbeef);
    });
    it('supports boxed Number.NaN', async () => {
      const back = await streamCross<Promise<Number>>(Promise.resolve(Object(Number.NaN)));
      expect(back).toBeInstanceOf(Number);
      expect(back.valueOf()).toBe(Number.NaN);
    });
    it('supports boxed Number.POSITIVE_INFINITY', async () => {
      const back = await streamCross<Promise<Number>>(Promise.resolve(Object(Number.POSITIVE_INFINITY)));
      expect(back).toBeInstanceOf(Number);
      expect(back.valueOf()).toBe(Number.POSITIVE_INFINITY);
    });
    it('supports boxed Number.NEGATIVE_INFINITY', async () => {
      const back = await streamCross<Promise<Number>>(Promise.resolve(Object(Number.NEGATIVE_INFINITY)));
      expect(back).toBeInstanceOf(Number);
      expect(back.valueOf()).toBe(Number.NEGATIVE_INFINITY);
    });
    it('supports boxed -0', async () => {
      const back = await streamCross<Promise<Number>>(Promise.resolve(Object(-0)));
      expect(back).toBeInstanceOf(Number);
      expect(back.valueOf()).toBe(-0);
    });
    describe('scoped', () => {
      it('supports boxed numbers', async () => {
        const back = await streamCross<Promise<Number>>(Promise.resolve(Object(0xdeadbeef)), { scopeId: 'example' });
        expect(back).toBeInstanceOf(Number);
        expect(back.valueOf()).toBe(0xdeadbeef);
      });
      it('supports boxed Number.NaN', async () => {
        const back = await streamCross<Promise<Number>>(Promise.resolve(Object(Number.NaN)), { scopeId: 'example' });
        expect(back).toBeInstanceOf(Number);
        expect(back.valueOf()).toBe(Number.NaN);
      });
      it('supports boxed Number.POSITIVE_INFINITY', async () => {
        const back = await streamCross<Promise<Number>>(Promise.resolve(Object(Number.POSITIVE_INFINITY)), { scopeId: 'example' });
        expect(back).toBeInstanceOf(Number);
        expect(back.valueOf()).toBe(Number.POSITIVE_INFINITY);
      });
      it('supports boxed Number.NEGATIVE_INFINITY', async () => {
        const back = await streamCross<Promise<Number>>(Promise.resolve(Object(Number.NEGATIVE_INFINITY)), { scopeId: 'example' });
        expect(back).toBeInstanceOf(Number);
        expect(back.valueOf()).toBe(Number.NEGATIVE_INFINITY);
      });
      it('supports boxed -0', async () => {
        const back = await streamCross<Promise<Number>>(Promise.resolve(Object(-0)), { scopeId: 'example' });
        expect(back).toBeInstanceOf(Number);
        expect(back.valueOf()).toBe(-0);
      });
    });
  });
  describe('toCrossJSON', () => {
    it('supports boxed numbers', () => {
      {
        const back = fromCrossJSON<Number>(toCrossJSON(Object(0xdeadbeef)), { refs: new Map() });
        expect(back).toBeInstanceOf(Number);
        expect(back.valueOf()).toBe(0xdeadbeef);
      }
      {
        const back = fromCrossJSON<Number>(toCrossJSON(Object(Number.NaN)), { refs: new Map() });
        expect(back).toBeInstanceOf(Number);
        expect(back.valueOf()).toBe(Number.NaN);
      }
      {
        const back = fromCrossJSON<Number>(toCrossJSON(Object(Number.POSITIVE_INFINITY)), { refs: new Map() });
        expect(back).toBeInstanceOf(Number);
        expect(back.valueOf()).toBe(Number.POSITIVE_INFINITY);
      }
      {
        const back = fromCrossJSON<Number>(toCrossJSON(Object(Number.NEGATIVE_INFINITY)), { refs: new Map() });
        expect(back).toBeInstanceOf(Number);
        expect(back.valueOf()).toBe(Number.NEGATIVE_INFINITY);
      }
      {
        const back = fromCrossJSON<Number>(toCrossJSON(Object(-0)), { refs: new Map() });
        expect(back).toBeInstanceOf(Number);
        expect(back.valueOf()).toBe(-0);
      }
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports boxed numbers', async () => {
      {
        const back = await fromCrossJSON<Promise<Number>>(await toCrossJSONAsync(Promise.resolve(Object(0xdeadbeef))), { refs: new Map() });
        expect(back).toBeInstanceOf(Number);
        expect(back.valueOf()).toBe(0xdeadbeef);
      }
      {
        const back = await fromCrossJSON<Promise<Number>>(await toCrossJSONAsync(Promise.resolve(Object(Number.NaN))), { refs: new Map() });
        expect(back).toBeInstanceOf(Number);
        expect(back.valueOf()).toBe(Number.NaN);
      }
      {
        const back = await fromCrossJSON<Promise<Number>>(await toCrossJSONAsync(Promise.resolve(Object(Number.POSITIVE_INFINITY))), { refs: new Map() });
        expect(back).toBeInstanceOf(Number);
        expect(back.valueOf()).toBe(Number.POSITIVE_INFINITY);
      }
      {
        const back = await fromCrossJSON<Promise<Number>>(await toCrossJSONAsync(Promise.resolve(Object(Number.NEGATIVE_INFINITY))), { refs: new Map() });
        expect(back).toBeInstanceOf(Number);
        expect(back.valueOf()).toBe(Number.NEGATIVE_INFINITY);
      }
      {
        const back = await fromCrossJSON<Promise<Number>>(await toCrossJSONAsync(Promise.resolve(Object(-0))), { refs: new Map() });
        expect(back).toBeInstanceOf(Number);
        expect(back.valueOf()).toBe(-0);
      }
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports boxed numbers', async () => {
      const back = await streamCrossJSON<Promise<Number>>(Promise.resolve(Object(0xdeadbeef)));
      expect(back).toBeInstanceOf(Number);
      expect(back.valueOf()).toBe(0xdeadbeef);
    });
    it('supports boxed Number.NaN', async () => {
      const back = await streamCrossJSON<Promise<Number>>(Promise.resolve(Object(Number.NaN)));
      expect(back).toBeInstanceOf(Number);
      expect(back.valueOf()).toBe(Number.NaN);
    });
    it('supports boxed Number.POSITIVE_INFINITY', async () => {
      const back = await streamCrossJSON<Promise<Number>>(Promise.resolve(Object(Number.POSITIVE_INFINITY)));
      expect(back).toBeInstanceOf(Number);
      expect(back.valueOf()).toBe(Number.POSITIVE_INFINITY);
    });
    it('supports boxed Number.NEGATIVE_INFINITY', async () => {
      const back = await streamCrossJSON<Promise<Number>>(Promise.resolve(Object(Number.NEGATIVE_INFINITY)));
      expect(back).toBeInstanceOf(Number);
      expect(back.valueOf()).toBe(Number.NEGATIVE_INFINITY);
    });
    it('supports boxed -0', async () => {
      const back = await streamCrossJSON<Promise<Number>>(Promise.resolve(Object(-0)));
      expect(back).toBeInstanceOf(Number);
      expect(back.valueOf()).toBe(-0);
    });
  });
});
