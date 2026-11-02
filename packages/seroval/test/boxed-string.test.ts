import { describe, expect, it } from 'vitest';
import {
  crossSerialize,
  crossSerializeAsync,
  deserialize,
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

const QUOTED = '"hello"';
const HTML = '<script></script>';

describe('boxed string', () => {
  describe('serialize', () => {
    it('supports boxed strings', () => {
      expect(serialize(Object(QUOTED))).toMatchSnapshot();
      expect(serialize(Object(HTML))).toMatchSnapshot();
      expect(deserialize<object>(serialize(Object(QUOTED))).valueOf()).toBe(
        QUOTED,
      );
      expect(deserialize<object>(serialize(Object(HTML))).valueOf()).toBe(HTML);
    });
  });
  describe('serializeAsync', () => {
    it('supports boxed strings', async () => {
      expect((await deserialize<Promise<object>>(await serializeAsync(Promise.resolve(Object(QUOTED))))).valueOf()).toBe(QUOTED);
      expect((await deserialize<Promise<object>>(await serializeAsync(Promise.resolve(Object(HTML))))).valueOf()).toBe(HTML);
    });
  });
  describe('toJSON', () => {
    it('supports boxed strings', () => {
      expect(fromJSON<object>(toJSON(Object(QUOTED))).valueOf()).toBe(QUOTED);
      expect(fromJSON<object>(toJSON(Object(HTML))).valueOf()).toBe(HTML);
    });
  });
  describe('toJSONAsync', () => {
    it('supports boxed strings', async () => {
      expect((await fromJSON<Promise<object>>(await toJSONAsync(Promise.resolve(Object(QUOTED))))).valueOf()).toBe(QUOTED);
      expect((await fromJSON<Promise<object>>(await toJSONAsync(Promise.resolve(Object(HTML))))).valueOf()).toBe(HTML);
    });
  });
  describe('crossSerialize', () => {
    it('supports boxed strings', () => {
      expect(crossSerialize(Object(QUOTED))).toMatchSnapshot();
      expect(crossSerialize(Object(HTML))).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports boxed strings', () => {
        expect(
          crossSerialize(Object(QUOTED), { scopeId: 'example' }),
        ).toMatchSnapshot();
        expect(
          crossSerialize(Object(HTML), { scopeId: 'example' }),
        ).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports boxed strings', async () => {
      expect((await evaluateCross<Promise<object>>(await crossSerializeAsync(Promise.resolve(Object(QUOTED))))).valueOf()).toBe(QUOTED);
      expect((await evaluateCross<Promise<object>>(await crossSerializeAsync(Promise.resolve(Object(HTML))))).valueOf()).toBe(HTML);
    });
    describe('scoped', () => {
      it('supports boxed strings', async () => {
        expect((await evaluateCross<Promise<object>>(await crossSerializeAsync(Promise.resolve(Object(QUOTED)), {
            scopeId: 'example',
          }), 'example')).valueOf()).toBe(QUOTED);
        expect((await evaluateCross<Promise<object>>(await crossSerializeAsync(Promise.resolve(Object(HTML)), {
            scopeId: 'example',
          }), 'example')).valueOf()).toBe(HTML);
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports boxed strings', async () => {
      const back = await streamCross<Promise<object>>(Promise.resolve(Object(QUOTED)));
      expect(back.valueOf()).toBe(QUOTED);
    });
    it('supports boxed sanitized strings', async () => {
      const back = await streamCross<Promise<object>>(Promise.resolve(Object(HTML)));
      expect(back.valueOf()).toBe(HTML);
    });
    describe('scoped', () => {
      it('supports boxed strings', async () => {
        const back = await streamCross<Promise<object>>(Promise.resolve(Object(QUOTED)), { scopeId: 'example' });
        expect(back.valueOf()).toBe(QUOTED);
      });
      it('supports boxed sanitized strings', async () => {
        const back = await streamCross<Promise<object>>(Promise.resolve(Object(HTML)), { scopeId: 'example' });
        expect(back.valueOf()).toBe(HTML);
      });
    });
  });
  describe('toCrossJSON', () => {
    it('supports boxed strings', () => {
      expect(
        fromCrossJSON<object>(toCrossJSON(Object(QUOTED)), {
          refs: new Map(),
        }).valueOf(),
      ).toBe(QUOTED);
      expect(
        fromCrossJSON<object>(toCrossJSON(Object(HTML)), {
          refs: new Map(),
        }).valueOf(),
      ).toBe(HTML);
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports boxed strings', async () => {
      expect((await fromCrossJSON<Promise<object>>(await toCrossJSONAsync(Promise.resolve(Object(QUOTED))), {
        refs: new Map(),
      })).valueOf()).toBe(QUOTED);
      expect((await fromCrossJSON<Promise<object>>(await toCrossJSONAsync(Promise.resolve(Object(HTML))), {
        refs: new Map(),
      })).valueOf()).toBe(HTML);
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports boxed strings', async () => {
      const back = await streamCrossJSON<Promise<object>>(Promise.resolve(Object(QUOTED)));
      expect(back.valueOf()).toBe(QUOTED);
    });
    it('supports boxed sanitized strings', async () => {
      const back = await streamCrossJSON<Promise<object>>(Promise.resolve(Object(HTML)));
      expect(back.valueOf()).toBe(HTML);
    });
  });
});
