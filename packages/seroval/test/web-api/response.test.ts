import { describe, it, expect } from 'vitest';
import {
  crossSerializeAsync,
  crossSerializeStream,
  deserialize,
  fromCrossJSON,
  fromJSON,
  serializeAsync,
  toCrossJSONAsync,
  toCrossJSONStream,
  toJSONAsync,
} from '../../src';

const EXAMPLE_BODY = 'Hello World!';

describe('Response', () => {
  describe('serializeAsync', () => {
    it('supports Response', async () => {
      const example = new Response(EXAMPLE_BODY);
      const result = await serializeAsync(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof example>(result);
      expect(back).toBeInstanceOf(Response);
      expect(await back.text()).toBe(await example.text());
    });
  });
  describe('toJSONAsync', () => {
    it('supports Response', async () => {
      const example = new Response(EXAMPLE_BODY);
      const result = await toJSONAsync(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof example>(result);
      expect(back).toBeInstanceOf(Response);
      expect(await back.text()).toBe(await example.text());
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports Blob', async () => {
      const example = new Response(EXAMPLE_BODY);
      const result = await crossSerializeAsync(example);
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports Blob', async () => {
        const example = new Response(EXAMPLE_BODY);
        const result = await crossSerializeAsync(example, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });

  describe('crossSerializeStream', () => {
    it('supports Response', async () => new Promise<void>((done) => {
      const example = new Response(EXAMPLE_BODY);
      crossSerializeStream(example, {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    describe('scoped', () => {
      it('supports Response', async () => new Promise<void>((done) => {
        const example = new Response(EXAMPLE_BODY);
        crossSerializeStream(example, {
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
  describe('toJSONAsync', () => {
    it('supports Response', async () => {
      const example = new Response(EXAMPLE_BODY);
      const result = await toCrossJSONAsync(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof example>(result, {
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(Response);
      expect(await back.text()).toBe(await example.text());
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports Response', async () => new Promise<void>((done) => {
      const example = new Response(EXAMPLE_BODY);
      toCrossJSONStream(example, {
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
