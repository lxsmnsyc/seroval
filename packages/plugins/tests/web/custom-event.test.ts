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
} from 'seroval';
import { describe, expect, it } from 'vitest';
import CustomEventPlugin from '../../web/custom-event';
import { evaluateCross, streamCross, streamCrossJSON } from '../utils/cross';

const EXAMPLE_EVENT_TYPE = 'example';
const EXAMPLE_DETAIL: Record<string, unknown> = {};
EXAMPLE_DETAIL.self = EXAMPLE_DETAIL;
const EXAMPLE_OPTIONS: CustomEventInit = { detail: EXAMPLE_DETAIL };
const EXAMPLE = new CustomEvent(EXAMPLE_EVENT_TYPE, EXAMPLE_OPTIONS);

describe('CustomEvent', () => {
  describe('serialize', () => {
    it('supports CustomEvent', () => {
      const result = serialize(EXAMPLE, {
        plugins: [CustomEventPlugin],
      });
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof EXAMPLE>(result);
      expect(back).toBeInstanceOf(CustomEvent);
    });
  });
  describe('serializeAsync', () => {
    it('supports CustomEvent', async () => {
      const result = await serializeAsync(Promise.resolve(EXAMPLE), {
        plugins: [CustomEventPlugin],
      });
      const back = await deserialize<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(CustomEvent);
    });
  });
  describe('toJSON', () => {
    it('supports CustomEvent', () => {
      const result = toJSON(EXAMPLE, {
        plugins: [CustomEventPlugin],
      });
      const back = fromJSON<typeof EXAMPLE>(result, {
        plugins: [CustomEventPlugin],
      });
      expect(back).toBeInstanceOf(CustomEvent);
    });
  });
  describe('toJSONAsync', () => {
    it('supports CustomEvent', async () => {
      const example = Promise.resolve(EXAMPLE);
      const result = await toJSONAsync(example, {
        plugins: [CustomEventPlugin],
      });
      const back = await fromJSON<typeof example>(result, {
        plugins: [CustomEventPlugin],
      });
      expect(back).toBeInstanceOf(CustomEvent);
    });
  });
  describe('crossSerialize', () => {
    it('supports CustomEvent', () => {
      const result = crossSerialize(EXAMPLE, {
        plugins: [CustomEventPlugin],
      });
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports CustomEvent', () => {
        const result = crossSerialize(EXAMPLE, {
          plugins: [CustomEventPlugin],
          scopeId: 'example',
        });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports CustomEvent', async () => {
      const result = await crossSerializeAsync(Promise.resolve(EXAMPLE), {
        plugins: [CustomEventPlugin],
      });
      const back = await evaluateCross<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(CustomEvent);
      expect(back.type).toBe(EXAMPLE_EVENT_TYPE);
      expect(back.detail.self).toBe(back.detail);
    });
    describe('scoped', () => {
      it('supports CustomEvent', async () => {
        const result = await crossSerializeAsync(Promise.resolve(EXAMPLE), {
          plugins: [CustomEventPlugin],
          scopeId: 'example',
        });
        const back = await evaluateCross<Promise<typeof EXAMPLE>>(result, 'example');
        expect(back).toBeInstanceOf(CustomEvent);
        expect(back.type).toBe(EXAMPLE_EVENT_TYPE);
        expect(back.detail.self).toBe(back.detail);
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports CustomEvent', async () => {
      const back = await streamCross<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE), {
        plugins: [CustomEventPlugin],
      });
      expect(back).toBeInstanceOf(CustomEvent);
      expect(back.type).toBe(EXAMPLE_EVENT_TYPE);
      expect(back.detail.self).toBe(back.detail);
    });
    describe('scoped', () => {
      it('supports CustomEvent', async () => {
        const back = await streamCross<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE), {
          plugins: [CustomEventPlugin],
          scopeId: 'example',
        });
        expect(back).toBeInstanceOf(CustomEvent);
        expect(back.type).toBe(EXAMPLE_EVENT_TYPE);
        expect(back.detail.self).toBe(back.detail);
      });
    });
  });
  describe('toCrossJSON', () => {
    it('supports CustomEvent', () => {
      const result = toCrossJSON(EXAMPLE, {
        plugins: [CustomEventPlugin],
      });
      const back = fromCrossJSON<typeof EXAMPLE>(result, {
        plugins: [CustomEventPlugin],
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(CustomEvent);
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports CustomEvent', async () => {
      const example = Promise.resolve(EXAMPLE);
      const result = await toCrossJSONAsync(example, {
        plugins: [CustomEventPlugin],
      });
      const back = await fromCrossJSON<typeof example>(result, {
        plugins: [CustomEventPlugin],
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(CustomEvent);
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports CustomEvent', async () => {
      const back = await streamCrossJSON<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE), {
        plugins: [CustomEventPlugin],
      });
      expect(back).toBeInstanceOf(CustomEvent);
      expect(back.type).toBe(EXAMPLE_EVENT_TYPE);
      expect(back.detail.self).toBe(back.detail);
    });
  });
});
