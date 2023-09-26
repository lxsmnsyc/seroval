import { describe, it, expect } from 'vitest';
import {
  crossSerialize,
  crossSerializeAsync,
  crossSerializeStream,
  serialize,
  serializeAsync,
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
  });
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
