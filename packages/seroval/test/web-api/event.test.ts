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

describe('Event', () => {
  describe('serialize', () => {
    it('supports Event', () => {
      const example = new Event(EXAMPLE_EVENT_TYPE);
      const result = serialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<Event>(result);
      expect(back).toBeInstanceOf(Event);
    });
  });
  describe('serializeAsync', () => {
    it('supports Event', async () => {
      const example = new Event(EXAMPLE_EVENT_TYPE);
      const result = await serializeAsync(Promise.resolve(example));
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<Event>>(result);
      expect(back).toBeInstanceOf(Event);
    });
  });
  describe('toJSON', () => {
    it('supports Event', () => {
      const example = new Event(EXAMPLE_EVENT_TYPE);
      const result = toJSON(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<Event>(result);
      expect(back).toBeInstanceOf(Event);
    });
  });
  describe('toJSONAsync', () => {
    it('supports Event', async () => {
      const example = new Event(EXAMPLE_EVENT_TYPE);
      const result = await toJSONAsync(Promise.resolve(example));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<Event>>(result);
      expect(back).toBeInstanceOf(Event);
    });
  });
  describe('crossSerialize', () => {
    it('supports Event', () => {
      const example = new Event(EXAMPLE_EVENT_TYPE);
      const result = crossSerialize(example);
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports Event', () => {
        const example = new Event(EXAMPLE_EVENT_TYPE);
        const result = crossSerialize(example, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports Event', async () => {
      const example = new Event(EXAMPLE_EVENT_TYPE);
      const result = await crossSerializeAsync(Promise.resolve(example));
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports Event', async () => {
        const example = new Event(EXAMPLE_EVENT_TYPE);
        const result = await crossSerializeAsync(Promise.resolve(example), { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports Event', async () => new Promise<void>((done) => {
      const example = new Event(EXAMPLE_EVENT_TYPE);
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
      it('supports Event', async () => new Promise<void>((done) => {
        const example = new Event(EXAMPLE_EVENT_TYPE);
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
