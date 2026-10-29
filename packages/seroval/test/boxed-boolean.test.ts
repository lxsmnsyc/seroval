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

describe('boxed boolean', () => {
  describe('serialize', () => {
    it('supports boolean', () => {
      expect(serialize(Object(true))).toBe('Object(!0)');
      expect(serialize(Object(false))).toBe('Object(!1)');
    });
  });
  describe('serializeAsync', () => {
    it('supports boolean', async () => {
      expect(await serializeAsync(Object(true))).toBe('Object(!0)');
      expect(await serializeAsync(Object(false))).toBe('Object(!1)');
    });
  });
  describe('toJSON', () => {
    it('supports boolean', () => {
      {
        const back = fromJSON<Boolean>(toJSON(Object(true)));
        expect(back).toBeInstanceOf(Boolean);
        expect((back).valueOf()).toBe(true);
      }
      {
        const back = fromJSON<Boolean>(toJSON(Object(false)));
        expect(back).toBeInstanceOf(Boolean);
        expect((back).valueOf()).toBe(false);
      }
    });
  });
  describe('toJSONAsync', () => {
    it('supports boolean', async () => {
      {
        const back = await fromJSON<Promise<Boolean>>(await toJSONAsync(Promise.resolve(Object(true))));
        expect(back).toBeInstanceOf(Boolean);
        expect((back).valueOf()).toBe(true);
      }
      {
        const back = await fromJSON<Promise<Boolean>>(await toJSONAsync(Promise.resolve(Object(false))));
        expect(back).toBeInstanceOf(Boolean);
        expect((back).valueOf()).toBe(false);
      }
    });
  });
  describe('crossSerialize', () => {
    it('supports boolean', () => {
      expect(crossSerialize(Object(true))).toMatchSnapshot();
      expect(crossSerialize(Object(false))).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports boolean', () => {
        expect(
          crossSerialize(Object(true), { scopeId: 'example' }),
        ).toMatchSnapshot();
        expect(
          crossSerialize(Object(false), { scopeId: 'example' }),
        ).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports boolean', async () => {
      {
        const back = await evaluateCross<Promise<Boolean>>(await crossSerializeAsync(Object(true)));
        expect(back).toBeInstanceOf(Boolean);
        expect((back).valueOf()).toBe(true);
      }
      {
        const back = await evaluateCross<Promise<Boolean>>(await crossSerializeAsync(Object(false)));
        expect(back).toBeInstanceOf(Boolean);
        expect((back).valueOf()).toBe(false);
      }
    });
    describe('scoped', () => {
      it('supports boolean', async () => {
        {
          const back = await evaluateCross<Promise<Boolean>>(
          await crossSerializeAsync(Object(true), { scopeId: 'example' }),
          'example',
        );
          expect(back).toBeInstanceOf(Boolean);
          expect((back).valueOf()).toBe(true);
        }
        {
          const back = await evaluateCross<Promise<Boolean>>(
          await crossSerializeAsync(Object(false), { scopeId: 'example' }),
          'example',
        );
          expect(back).toBeInstanceOf(Boolean);
          expect((back).valueOf()).toBe(false);
        }
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports boxed true', async () => {
      const back = await streamCross<Promise<Boolean>>(Promise.resolve(Object(true)));
      expect(back).toBeInstanceOf(Boolean);
      expect((back).valueOf()).toBe(true);
    });
    it('supports boxed false', async () => {
      const back = await streamCross<Promise<Boolean>>(Promise.resolve(Object(false)));
      expect(back).toBeInstanceOf(Boolean);
      expect((back).valueOf()).toBe(false);
    });
    describe('scoped', () => {
      it('supports boxed true', async () => {
        const back = await streamCross<Promise<Boolean>>(Promise.resolve(Object(true)), { scopeId: 'example' });
        expect(back).toBeInstanceOf(Boolean);
        expect((back).valueOf()).toBe(true);
      });
      it('supports boxed false', async () => {
        const back = await streamCross<Promise<Boolean>>(Promise.resolve(Object(false)), { scopeId: 'example' });
        expect(back).toBeInstanceOf(Boolean);
        expect((back).valueOf()).toBe(false);
      });
    });
  });
  describe('toCrossJSON', () => {
    it('supports boolean', () => {
      {
        const back = fromCrossJSON<Boolean>(toCrossJSON(Object(true)), { refs: new Map() });
        expect(back).toBeInstanceOf(Boolean);
        expect((back).valueOf()).toBe(true);
      }
      {
        const back = fromCrossJSON<Boolean>(toCrossJSON(Object(false)), { refs: new Map() });
        expect(back).toBeInstanceOf(Boolean);
        expect((back).valueOf()).toBe(false);
      }
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports boolean', async () => {
      {
        const back = await fromCrossJSON<Promise<Boolean>>(await toCrossJSONAsync(Promise.resolve(Object(true))), { refs: new Map() });
        expect(back).toBeInstanceOf(Boolean);
        expect((back).valueOf()).toBe(true);
      }
      {
        const back = await fromCrossJSON<Promise<Boolean>>(await toCrossJSONAsync(Promise.resolve(Object(false))), { refs: new Map() });
        expect(back).toBeInstanceOf(Boolean);
        expect((back).valueOf()).toBe(false);
      }
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports boxed true', async () => {
      const back = await streamCrossJSON<Promise<Boolean>>(Promise.resolve(Object(true)));
      expect(back).toBeInstanceOf(Boolean);
      expect((back).valueOf()).toBe(true);
    });
    it('supports boxed false', async () => {
      const back = await streamCrossJSON<Promise<Boolean>>(Promise.resolve(Object(false)));
      expect(back).toBeInstanceOf(Boolean);
      expect((back).valueOf()).toBe(false);
    });
  });
});
