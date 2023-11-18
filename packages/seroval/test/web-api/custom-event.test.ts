import { describe, it, expect } from 'vitest';
import {
  crossSerialize,
  crossSerializeAsync,
  crossSerializeStream,
  deserialize,
  fromCrossJSON,
  fromJSON,
  serialize,
  serializeAsync,
  toCrossJSON,
  toCrossJSONAsync,
  toCrossJSONStream,
  toJSON,
  toJSONAsync,
} from '../../src';

const EXAMPLE_EVENT_TYPE = 'example';
const EXAMPLE_DETAIL: Record<string, unknown> = {};
EXAMPLE_DETAIL.self = EXAMPLE_DETAIL;
const EXAMPLE_OPTIONS: CustomEventInit = { detail: EXAMPLE_DETAIL };
const EXAMPLE = new CustomEvent(EXAMPLE_EVENT_TYPE, EXAMPLE_OPTIONS);

describe('CustomEvent', () => {
  describe('serialize', () => {
    it('supports CustomEvent', () => {
      const result = serialize(EXAMPLE);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof EXAMPLE>(result);
      expect(back).toBeInstanceOf(CustomEvent);
    });
  });
  describe('serializeAsync', () => {
    it('supports CustomEvent', async () => {
      const result = await serializeAsync(Promise.resolve(EXAMPLE));
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(CustomEvent);
    });
  });
  describe('toJSON', () => {
    it('supports CustomEvent', () => {
      const result = toJSON(EXAMPLE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof EXAMPLE>(result);
      expect(back).toBeInstanceOf(CustomEvent);
    });
  });
  describe('toJSONAsync', () => {
    it('supports CustomEvent', async () => {
      const example = Promise.resolve(EXAMPLE);
      const result = await toJSONAsync(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<typeof example>(result);
      expect(back).toBeInstanceOf(CustomEvent);
    });
  });
  describe('crossSerialize', () => {
    it('supports CustomEvent', () => {
      const result = crossSerialize(EXAMPLE);
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports CustomEvent', () => {
        const result = crossSerialize(EXAMPLE, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports CustomEvent', async () => {
      const result = await crossSerializeAsync(Promise.resolve(EXAMPLE));
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports CustomEvent', async () => {
        const result = await crossSerializeAsync(Promise.resolve(EXAMPLE), { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports CustomEvent', async () => new Promise<void>((resolve, reject) => {
      crossSerializeStream(Promise.resolve(EXAMPLE), {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          resolve();
        },
        onError(error) {
          reject(error);
        },
      });
    }));
    describe('scoped', () => {
      it('supports CustomEvent', async () => new Promise<void>((resolve, reject) => {
        crossSerializeStream(Promise.resolve(EXAMPLE), {
          scopeId: 'example',
          onSerialize(data) {
            expect(data).toMatchSnapshot();
          },
          onDone() {
            resolve();
          },
          onError(error) {
            reject(error);
          },
        });
      }));
    });
  });
  describe('toCrossJSON', () => {
    it('supports CustomEvent', () => {
      const result = toCrossJSON(EXAMPLE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof EXAMPLE>(result, {
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(CustomEvent);
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports CustomEvent', async () => {
      const example = Promise.resolve(EXAMPLE);
      const result = await toCrossJSONAsync(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromCrossJSON<typeof example>(result, {
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(CustomEvent);
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports CustomEvent', async () => new Promise<void>((resolve, reject) => {
      toCrossJSONStream(Promise.resolve(EXAMPLE), {
        onParse(data) {
          expect(JSON.stringify(data)).toMatchSnapshot();
        },
        onDone() {
          resolve();
        },
        onError(error) {
          reject(error);
        },
      });
    }));
  });
});
