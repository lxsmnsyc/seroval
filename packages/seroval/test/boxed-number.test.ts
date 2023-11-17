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

describe('boxed number', () => {
  describe('serialize', () => {
    it('supports boxed numbers', () => {
      const value = 0xDEADBEEF;
      expect(serialize(Object(value))).toBe(`Object(${value})`);
      expect(serialize(Object(NaN))).toBe('Object(0/0)');
      expect(serialize(Object(Infinity))).toBe('Object(1/0)');
      expect(serialize(Object(-Infinity))).toBe('Object(-1/0)');
      expect(serialize(Object(-0))).toBe('Object(-0)');
    });
  });
  describe('serializeAsync', () => {
    it('supports boxed numbers', async () => {
      const value = 0xDEADBEEF;
      expect(await serializeAsync(Promise.resolve(Object(value)))).toBe(`Promise.resolve(Object(${value}))`);
      expect(await serializeAsync(Promise.resolve(Object(NaN)))).toBe('Promise.resolve(Object(0/0))');
      expect(await serializeAsync(Promise.resolve(Object(Infinity)))).toBe('Promise.resolve(Object(1/0))');
      expect(await serializeAsync(Promise.resolve(Object(-Infinity)))).toBe('Promise.resolve(Object(-1/0))');
      expect(await serializeAsync(Promise.resolve(Object(-0)))).toBe('Promise.resolve(Object(-0))');
    });
  });
  describe('toJSON', () => {
    it('supports boxed numbers', () => {
      const value = 0xDEADBEEF;
      expect(JSON.stringify(toJSON(Object(value)))).toMatchSnapshot();
      expect(JSON.stringify(toJSON(Object(NaN)))).toMatchSnapshot();
      expect(JSON.stringify(toJSON(Object(Infinity)))).toMatchSnapshot();
      expect(JSON.stringify(toJSON(Object(-Infinity)))).toMatchSnapshot();
      expect(JSON.stringify(toJSON(Object(-0)))).toMatchSnapshot();
    });
  });
  describe('toJSONAsync', () => {
    it('supports boxed numbers', async () => {
      const value = 0xDEADBEEF;
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(Object(value)))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(Object(NaN)))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(Object(Infinity)))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(Object(-Infinity)))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(Object(-0)))),
      ).toMatchSnapshot();
    });
  });
  describe('crossSerialize', () => {
    it('supports boxed numbers', () => {
      const value = 0xDEADBEEF;
      expect(crossSerialize(Object(value))).toMatchSnapshot();
      expect(crossSerialize(Object(NaN))).toMatchSnapshot();
      expect(crossSerialize(Object(Infinity))).toMatchSnapshot();
      expect(crossSerialize(Object(-Infinity))).toMatchSnapshot();
      expect(crossSerialize(Object(-0))).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports boxed numbers', () => {
        const value = 0xDEADBEEF;
        expect(crossSerialize(Object(value), { scopeId: 'example' })).toMatchSnapshot();
        expect(crossSerialize(Object(NaN), { scopeId: 'example' })).toMatchSnapshot();
        expect(crossSerialize(Object(Infinity), { scopeId: 'example' })).toMatchSnapshot();
        expect(crossSerialize(Object(-Infinity), { scopeId: 'example' })).toMatchSnapshot();
        expect(crossSerialize(Object(-0), { scopeId: 'example' })).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports boxed numbers', async () => {
      const value = 0xDEADBEEF;
      expect(await crossSerializeAsync(Promise.resolve(Object(value)))).toMatchSnapshot();
      expect(await crossSerializeAsync(Promise.resolve(Object(NaN)))).toMatchSnapshot();
      expect(await crossSerializeAsync(Promise.resolve(Object(Infinity)))).toMatchSnapshot();
      expect(await crossSerializeAsync(Promise.resolve(Object(-Infinity)))).toMatchSnapshot();
      expect(await crossSerializeAsync(Promise.resolve(Object(-0)))).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports boxed numbers', async () => {
        const value = 0xDEADBEEF;
        expect(await crossSerializeAsync(Promise.resolve(Object(value)), { scopeId: 'example' })).toMatchSnapshot();
        expect(await crossSerializeAsync(Promise.resolve(Object(NaN)), { scopeId: 'example' })).toMatchSnapshot();
        expect(await crossSerializeAsync(Promise.resolve(Object(Infinity)), { scopeId: 'example' })).toMatchSnapshot();
        expect(await crossSerializeAsync(Promise.resolve(Object(-Infinity)), { scopeId: 'example' })).toMatchSnapshot();
        expect(await crossSerializeAsync(Promise.resolve(Object(-0)), { scopeId: 'example' })).toMatchSnapshot();
      });
    });
  });

  describe('crossSerializeStream', () => {
    it('supports boxed numbers', async () => new Promise<void>((done) => {
      crossSerializeStream(Promise.resolve(Object(0xDEADBEEF)), {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    it('supports boxed NaN', async () => new Promise<void>((done) => {
      crossSerializeStream(Promise.resolve(Object(NaN)), {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    it('supports boxed Infinity', async () => new Promise<void>((done) => {
      crossSerializeStream(Promise.resolve(Object(Infinity)), {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    it('supports boxed -Infinity', async () => new Promise<void>((done) => {
      crossSerializeStream(Promise.resolve(Object(-Infinity)), {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    it('supports boxed -0', async () => new Promise<void>((done) => {
      crossSerializeStream(Promise.resolve(Object(-0)), {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    describe('scoped', () => {
      it('supports boxed numbers', async () => new Promise<void>((done) => {
        crossSerializeStream(Promise.resolve(Object(0xDEADBEEF)), {
          scopeId: 'example',
          onSerialize(data) {
            expect(data).toMatchSnapshot();
          },
          onDone() {
            done();
          },
        });
      }));
      it('supports boxed NaN', async () => new Promise<void>((done) => {
        crossSerializeStream(Promise.resolve(Object(NaN)), {
          scopeId: 'example',
          onSerialize(data) {
            expect(data).toMatchSnapshot();
          },
          onDone() {
            done();
          },
        });
      }));
      it('supports boxed Infinity', async () => new Promise<void>((done) => {
        crossSerializeStream(Promise.resolve(Object(Infinity)), {
          scopeId: 'example',
          onSerialize(data) {
            expect(data).toMatchSnapshot();
          },
          onDone() {
            done();
          },
        });
      }));
      it('supports boxed -Infinity', async () => new Promise<void>((done) => {
        crossSerializeStream(Promise.resolve(Object(-Infinity)), {
          scopeId: 'example',
          onSerialize(data) {
            expect(data).toMatchSnapshot();
          },
          onDone() {
            done();
          },
        });
      }));
      it('supports boxed -0', async () => new Promise<void>((done) => {
        crossSerializeStream(Promise.resolve(Object(-0)), {
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
    it('supports boxed numbers', () => {
      const value = 0xDEADBEEF;
      expect(JSON.stringify(toCrossJSON(Object(value)))).toMatchSnapshot();
      expect(JSON.stringify(toCrossJSON(Object(NaN)))).toMatchSnapshot();
      expect(JSON.stringify(toCrossJSON(Object(Infinity)))).toMatchSnapshot();
      expect(JSON.stringify(toCrossJSON(Object(-Infinity)))).toMatchSnapshot();
      expect(JSON.stringify(toCrossJSON(Object(-0)))).toMatchSnapshot();
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports boxed numbers', async () => {
      const value = 0xDEADBEEF;
      expect(
        JSON.stringify(await toCrossJSONAsync(Promise.resolve(Object(value)))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toCrossJSONAsync(Promise.resolve(Object(NaN)))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toCrossJSONAsync(Promise.resolve(Object(Infinity)))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toCrossJSONAsync(Promise.resolve(Object(-Infinity)))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toCrossJSONAsync(Promise.resolve(Object(-0)))),
      ).toMatchSnapshot();
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports boxed numbers', async () => new Promise<void>((done) => {
      toCrossJSONStream(Promise.resolve(Object(0xDEADBEEF)), {
        onParse(data) {
          expect(JSON.stringify(data)).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    it('supports boxed NaN', async () => new Promise<void>((done) => {
      toCrossJSONStream(Promise.resolve(Object(NaN)), {
        onParse(data) {
          expect(JSON.stringify(data)).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    it('supports boxed Infinity', async () => new Promise<void>((done) => {
      toCrossJSONStream(Promise.resolve(Object(Infinity)), {
        onParse(data) {
          expect(JSON.stringify(data)).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    it('supports boxed -Infinity', async () => new Promise<void>((done) => {
      toCrossJSONStream(Promise.resolve(Object(-Infinity)), {
        onParse(data) {
          expect(JSON.stringify(data)).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    it('supports boxed -0', async () => new Promise<void>((done) => {
      toCrossJSONStream(Promise.resolve(Object(-0)), {
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
