import {
  crossSerializeAsync,
  deserialize,
  fromCrossJSON,
  fromJSON,
  serializeAsync,
  toCrossJSONAsync,
  toJSONAsync,
} from 'seroval';
import { describe, expect, it } from 'vitest';
import ResponsePlugin from '../../web/response';
import { evaluateCross, streamCross, streamCrossJSON } from '../utils/cross';

const EXAMPLE_BODY = 'Hello World!';

describe('Response', () => {
  describe('serializeAsync', () => {
    it('supports Response', async () => {
      const example = new Response(EXAMPLE_BODY);
      const result = await serializeAsync(example, {
        plugins: [ResponsePlugin],
      });
      const back = deserialize<typeof example>(result);
      expect(back).toBeInstanceOf(Response);
      expect(await back.text()).toBe(await example.text());
    });
  });
  describe('toJSONAsync', () => {
    it('supports Response', async () => {
      const example = new Response(EXAMPLE_BODY);
      const result = await toJSONAsync(example, {
        plugins: [ResponsePlugin],
      });
      const back = fromJSON<typeof example>(result, {
        plugins: [ResponsePlugin],
      });
      expect(back).toBeInstanceOf(Response);
      expect(await back.text()).toBe(await example.text());
    });

    it('supports already read Response', async () => {
      const example = new Response(EXAMPLE_BODY);
      await example.text();
      const result = await toJSONAsync(example, {
        plugins: [ResponsePlugin],
      });
      const back = fromJSON<typeof example>(result, {
        plugins: [ResponsePlugin],
      });
      expect(back).toBeInstanceOf(Response);
      expect(back.body).toBe(null);
    });
  });

  describe('crossSerializeAsync', () => {
    it('supports Response', async () => {
      const example = new Response(EXAMPLE_BODY);
      const result = await crossSerializeAsync(example, {
        plugins: [ResponsePlugin],
      });
      const back = evaluateCross<typeof example>(result);
      expect(back).toBeInstanceOf(Response);
      expect(await back.text()).toBe(EXAMPLE_BODY);
    });
    describe('scoped', () => {
      it('supports Response', async () => {
        const example = new Response(EXAMPLE_BODY);
        const result = await crossSerializeAsync(example, {
          plugins: [ResponsePlugin],
          scopeId: 'example',
        });
        const back = evaluateCross<typeof example>(result, 'example');
        expect(back).toBeInstanceOf(Response);
        expect(await back.text()).toBe(EXAMPLE_BODY);
      });
    });
  });

  describe('crossSerializeStream', () => {
    it('supports Response', async () => {
      const example = new Response(EXAMPLE_BODY);
      const back = await streamCross<typeof example>(example, {
        plugins: [ResponsePlugin],
      });
      expect(back).toBeInstanceOf(Response);
      expect(await back.text()).toBe(EXAMPLE_BODY);
    });

    it('supports already read Response', async () => {
      const example = new Response(EXAMPLE_BODY);
      await example.text();
      const back = await streamCross<typeof example>(example, {
        plugins: [ResponsePlugin],
      });
      expect(back).toBeInstanceOf(Response);
      expect(back.body).toBe(null);
    });

    describe('scoped', () => {
      it('supports Response', async () => {
        const example = new Response(EXAMPLE_BODY);
        const back = await streamCross<typeof example>(example, {
          plugins: [ResponsePlugin],
          scopeId: 'example',
        });
        expect(back).toBeInstanceOf(Response);
        expect(await back.text()).toBe(EXAMPLE_BODY);
      });
    });
  });
  describe('toJSONAsync', () => {
    it('supports Response', async () => {
      const example = new Response(EXAMPLE_BODY);
      const result = await toCrossJSONAsync(example, {
        plugins: [ResponsePlugin],
      });
      const back = fromCrossJSON<typeof example>(result, {
        plugins: [ResponsePlugin],
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(Response);
      expect(await back.text()).toBe(await example.text());
    });
  });

  it('supports already read Response', async () => {
    const example = new Response(EXAMPLE_BODY);
    await example.text();
    const result = await toCrossJSONAsync(example, {
      plugins: [ResponsePlugin],
    });
    expect(JSON.stringify(result)).toMatchSnapshot();
    const back = fromCrossJSON<typeof example>(result, {
      plugins: [ResponsePlugin],
      refs: new Map(),
    });
    expect(back).toBeInstanceOf(Response);
    expect(back.body).toBe(null);
  });

  describe('toCrossJSONStream', () => {
    it('supports Response', async () => {
      const example = new Response(EXAMPLE_BODY);
      const back = await streamCrossJSON<typeof example>(example, {
        plugins: [ResponsePlugin],
      });
      expect(back).toBeInstanceOf(Response);
      expect(await back.text()).toBe(EXAMPLE_BODY);
    });
  });
});
