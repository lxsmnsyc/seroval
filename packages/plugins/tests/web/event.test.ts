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
import EventPlugin from '../../web/event';
import { evaluateCross, streamCross, streamCrossJSON } from '../utils/cross';

const EXAMPLE_EVENT_TYPE = 'example';
const EXAMPLE = new Event(EXAMPLE_EVENT_TYPE);

describe('Event', () => {
  describe('serialize', () => {
    it('supports Event', () => {
      const result = serialize(EXAMPLE, {
        plugins: [EventPlugin],
      });
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof EXAMPLE>(result);
      expect(back).toBeInstanceOf(Event);
    });
  });
  describe('serializeAsync', () => {
    it('supports Event', async () => {
      const result = await serializeAsync(Promise.resolve(EXAMPLE), {
        plugins: [EventPlugin],
      });
      const back = await deserialize<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(Event);
    });
  });
  describe('toJSON', () => {
    it('supports Event', () => {
      const result = toJSON(EXAMPLE, {
        plugins: [EventPlugin],
      });
      const back = fromJSON<typeof EXAMPLE>(result, {
        plugins: [EventPlugin],
      });
      expect(back).toBeInstanceOf(Event);
    });
  });
  describe('toJSONAsync', () => {
    it('supports Event', async () => {
      const result = await toJSONAsync(Promise.resolve(EXAMPLE), {
        plugins: [EventPlugin],
      });
      const back = await fromJSON<Promise<typeof EXAMPLE>>(result, {
        plugins: [EventPlugin],
      });
      expect(back).toBeInstanceOf(Event);
    });
  });
  describe('crossSerialize', () => {
    it('supports Event', () => {
      const result = crossSerialize(EXAMPLE, {
        plugins: [EventPlugin],
      });
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports Event', () => {
        const result = crossSerialize(EXAMPLE, {
          plugins: [EventPlugin],
          scopeId: 'example',
        });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports Event', async () => {
      const result = await crossSerializeAsync(Promise.resolve(EXAMPLE), {
        plugins: [EventPlugin],
      });
      const back = await evaluateCross<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(Event);
      expect(back.type).toBe(EXAMPLE_EVENT_TYPE);
    });
    describe('scoped', () => {
      it('supports Event', async () => {
        const result = await crossSerializeAsync(Promise.resolve(EXAMPLE), {
          plugins: [EventPlugin],
          scopeId: 'example',
        });
        const back = await evaluateCross<Promise<typeof EXAMPLE>>(result, 'example');
        expect(back).toBeInstanceOf(Event);
        expect(back.type).toBe(EXAMPLE_EVENT_TYPE);
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports Event', async () => {
      const back = await streamCross<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE), {
        plugins: [EventPlugin],
      });
      expect(back).toBeInstanceOf(Event);
      expect(back.type).toBe(EXAMPLE_EVENT_TYPE);
    });
    describe('scoped', () => {
      it('supports Event', async () => {
        const back = await streamCross<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE), {
          plugins: [EventPlugin],
          scopeId: 'example',
        });
        expect(back).toBeInstanceOf(Event);
        expect(back.type).toBe(EXAMPLE_EVENT_TYPE);
      });
    });
  });
  describe('toCrossJSON', () => {
    it('supports Event', () => {
      const result = toCrossJSON(EXAMPLE, {
        plugins: [EventPlugin],
      });
      const back = fromCrossJSON<typeof EXAMPLE>(result, {
        plugins: [EventPlugin],
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(Event);
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports Event', async () => {
      const example = Promise.resolve(EXAMPLE);
      const result = await toCrossJSONAsync(example, {
        plugins: [EventPlugin],
      });
      const back = await fromCrossJSON<typeof example>(result, {
        plugins: [EventPlugin],
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(Event);
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports Event', async () => {
      const back = await streamCrossJSON<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE), {
        plugins: [EventPlugin],
      });
      expect(back).toBeInstanceOf(Event);
      expect(back.type).toBe(EXAMPLE_EVENT_TYPE);
    });
  });
});
