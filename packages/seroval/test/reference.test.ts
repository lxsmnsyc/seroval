import { describe, it, expect } from 'vitest';
import {
  createReference,
  crossSerialize,
  crossSerializeAsync,
  crossSerializeStream,
  deserialize,
  fromJSON,
  serialize,
  serializeAsync,
  toJSON,
  toJSONAsync,
} from '../src';

describe('Reference', () => {
  describe('serialize', () => {
    it('supports Reference', () => {
      const example = createReference('example', () => 'Hello World');
      const result = serialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof example>(result);
      expect(back).toBe(example);
    });
  });
  describe('serializeAsync', () => {
    it('supports Reference', async () => {
      const example = createReference('example', () => 'Hello World');
      const result = await serializeAsync(Promise.resolve(example));
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<typeof example>>(result);
      expect(back).toBe(example);
    });
  });
  describe('toJSON', () => {
    it('supports Reference', () => {
      const example = createReference('example', () => 'Hello World');
      const result = toJSON(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof example>(result);
      expect(back).toBe(example);
    });
  });
  describe('toJSONAsync', () => {
    it('supports Reference', async () => {
      const example = createReference('example', () => 'Hello World');
      const result = await toJSONAsync(Promise.resolve(example));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<typeof example>>(result);
      expect(back).toBe(example);
    });
  });
  describe('crossSerialize', () => {
    it('supports Reference', () => {
      const example = createReference('example', () => 'Hello World');
      const result = crossSerialize(example);
      expect(result).toMatchSnapshot();
    });
    describe('crossSerialize', () => {
      it('supports Reference', () => {
        const example = createReference('example', () => 'Hello World');
        const result = crossSerialize(example, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports Reference', async () => {
      const example = createReference('example', () => 'Hello World');
      const result = await crossSerializeAsync(Promise.resolve(example));
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports Reference', async () => {
        const example = createReference('example', () => 'Hello World');
        const result = await crossSerializeAsync(Promise.resolve(example), { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports Reference', async () => new Promise<void>((done) => {
      const example = createReference('example', () => 'Hello World');
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
      it('supports Reference', async () => new Promise<void>((done) => {
        const example = createReference('example', () => 'Hello World');
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
