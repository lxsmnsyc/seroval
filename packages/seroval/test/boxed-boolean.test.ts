import { describe, it, expect } from 'vitest';
import {
  crossSerialize,
  crossSerializeAsync,
  crossSerializeStream,
  serialize,
  serializeAsync,
  toCrossJSON,
  toCrossJSONAsync,
  toCrossJSONStream,
  toJSON,
  toJSONAsync,
} from '../src';

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
      expect(JSON.stringify(toJSON(Object(true)))).toMatchSnapshot();
      expect(JSON.stringify(toJSON(Object(false)))).toMatchSnapshot();
    });
  });
  describe('toJSONAsync', () => {
    it('supports boolean', async () => {
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(Object(true)))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(Object(false)))),
      ).toMatchSnapshot();
    });
  });
  describe('crossSerialize', () => {
    it('supports boolean', () => {
      expect(crossSerialize(Object(true))).toMatchSnapshot();
      expect(crossSerialize(Object(false))).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports boolean', () => {
        expect(crossSerialize(Object(true), { scopeId: 'example' })).toMatchSnapshot();
        expect(crossSerialize(Object(false), { scopeId: 'example' })).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports boolean', async () => {
      expect(await crossSerializeAsync(Object(true))).toMatchSnapshot();
      expect(await crossSerializeAsync(Object(false))).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports boolean', async () => {
        expect(await crossSerializeAsync(Object(true), { scopeId: 'example' })).toMatchSnapshot();
        expect(await crossSerializeAsync(Object(false), { scopeId: 'example' })).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports boxed true', async () => new Promise<void>((done) => {
      crossSerializeStream(Promise.resolve(Object(true)), {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    it('supports boxed false', async () => new Promise<void>((done) => {
      crossSerializeStream(Promise.resolve(Object(false)), {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    describe('scoped', () => {
      it('supports boxed true', async () => new Promise<void>((done) => {
        crossSerializeStream(Promise.resolve(Object(true)), {
          scopeId: 'example',
          onSerialize(data) {
            expect(data).toMatchSnapshot();
          },
          onDone() {
            done();
          },
        });
      }));
      it('supports boxed false', async () => new Promise<void>((done) => {
        crossSerializeStream(Promise.resolve(Object(false)), {
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
    it('supports boolean', () => {
      expect(JSON.stringify(toCrossJSON(Object(true)))).toMatchSnapshot();
      expect(JSON.stringify(toCrossJSON(Object(false)))).toMatchSnapshot();
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports boolean', async () => {
      expect(
        JSON.stringify(await toCrossJSONAsync(Promise.resolve(Object(true)))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toCrossJSONAsync(Promise.resolve(Object(false)))),
      ).toMatchSnapshot();
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports boxed true', async () => new Promise<void>((done) => {
      toCrossJSONStream(Promise.resolve(Object(true)), {
        onParse(data) {
          expect(JSON.stringify(data)).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    it('supports boxed false', async () => new Promise<void>((done) => {
      toCrossJSONStream(Promise.resolve(Object(false)), {
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
