import { describe, it, expect } from 'vitest';
import {
  crossSerialize,
  crossSerializeAsync,
  crossSerializeStream,
  deserialize,
  fromJSON,
  serialize,
  serializeAsync,
  toJSON,
  toJSONAsync,
} from '../../src';

const EXAMPLE_EVENT_TYPE = 'example';
const EXAMPLE_DETAIL: Record<string, unknown> = {};
EXAMPLE_DETAIL.self = EXAMPLE_DETAIL;
const EXAMPLE_OPTIONS: CustomEventInit = { detail: EXAMPLE_DETAIL };

describe('CustomEvent', () => {
  describe('serialize', () => {
    it('supports CustomEvent', () => {
      const example = new CustomEvent(EXAMPLE_EVENT_TYPE, EXAMPLE_OPTIONS);
      const result = serialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<CustomEvent>(result);
      expect(back).toBeInstanceOf(CustomEvent);
    });
  });
  describe('serializeAsync', () => {
    it('supports CustomEvent', async () => {
      const example = new CustomEvent(EXAMPLE_EVENT_TYPE, EXAMPLE_OPTIONS);
      const result = await serializeAsync(Promise.resolve(example));
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<CustomEvent>>(result);
      expect(back).toBeInstanceOf(CustomEvent);
    });
  });
  describe('toJSON', () => {
    it('supports CustomEvent', () => {
      const example = new CustomEvent(EXAMPLE_EVENT_TYPE, EXAMPLE_OPTIONS);
      const result = toJSON(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<CustomEvent>(result);
      expect(back).toBeInstanceOf(CustomEvent);
    });
  });
  describe('toJSONAsync', () => {
    it('supports CustomEvent', async () => {
      const example = new CustomEvent(EXAMPLE_EVENT_TYPE, EXAMPLE_OPTIONS);
      const result = await toJSONAsync(Promise.resolve(example));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<CustomEvent>>(result);
      expect(back).toBeInstanceOf(CustomEvent);
    });
  });
  describe('crossSerialize', () => {
    it('supports CustomEvent', () => {
      const example = new CustomEvent(EXAMPLE_EVENT_TYPE, EXAMPLE_OPTIONS);
      const result = crossSerialize(example);
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports CustomEvent', () => {
        const example = new CustomEvent(EXAMPLE_EVENT_TYPE, EXAMPLE_OPTIONS);
        const result = crossSerialize(example, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports CustomEvent', async () => {
      const example = new CustomEvent(EXAMPLE_EVENT_TYPE, EXAMPLE_OPTIONS);
      const result = await crossSerializeAsync(Promise.resolve(example));
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports CustomEvent', async () => {
        const example = new CustomEvent(EXAMPLE_EVENT_TYPE, EXAMPLE_OPTIONS);
        const result = await crossSerializeAsync(Promise.resolve(example), { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports CustomEvent', async () => new Promise<void>((done) => {
      const example = new CustomEvent(EXAMPLE_EVENT_TYPE, EXAMPLE_OPTIONS);
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
      it('supports CustomEvent', async () => new Promise<void>((done) => {
        const example = new CustomEvent(EXAMPLE_EVENT_TYPE, EXAMPLE_OPTIONS);
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
