import { assert, describe, expect, it } from 'vitest';
import type { StreamListener } from '../src';
import {
  SerovalParserError,
  SerovalUnsupportedTypeError,
  Stream,
  createLiveStream,
  createStream,
  crossSerialize,
  deserialize,
  fromCrossJSON,
  fromJSON,
  serialize,
  toCrossJSON,
  toJSON,
} from '../src';

interface Subscribable {
  on(listener: StreamListener<unknown>): () => void;
}

const ROUND_TRIPS = {
  serialize: <T>(value: T): T => deserialize<T>(serialize(value)),
  toJSON: <T>(value: T): T => fromJSON<T>(toJSON(value)),
  crossSerialize: <T>(value: T): T => {
    (globalThis as { self?: unknown }).self = globalThis;
    try {
      return deserialize<T>(`(self.$R=self.$R||[],${crossSerialize(value)})`);
    } finally {
      delete (globalThis as { self?: unknown }).self;
    }
  },
  toCrossJSON: <T>(value: T): T => fromCrossJSON<T>(toCrossJSON(value), { refs: new Map() }),
};

type Event = ['next' | 'throw' | 'return', unknown];

/** Streams replay their events to a new listener synchronously. */
function readEvents(stream: unknown): Event[] {
  const events: Event[] = [];
  (stream as Subscribable).on({
    next: (value) => events.push(['next', value]),
    throw: (value) => events.push(['throw', value]),
    return: (value) => events.push(['return', value]),
  });
  return events;
}

function expectUnsupported(run: () => unknown, value: unknown): void {
  let caught: unknown;
  try {
    run();
  } catch (error) {
    caught = error;
  }
  assert(caught instanceof SerovalParserError);
  const cause = caught.cause;
  assert(cause instanceof SerovalUnsupportedTypeError);
  expect(cause.value).toBe(value);
}

describe('streams in sync functions', () => {
  for (const [name, roundTrip] of Object.entries(ROUND_TRIPS)) {
    describe(name, () => {
      it('sends every event of a stream that returned', () => {
        const stream = createStream<number>();
        stream.next(1);
        stream.next(2);
        stream.return(3);
        const copy = roundTrip({ value: stream });
        expect(readEvents(copy.value)).toEqual([
          ['next', 1],
          ['next', 2],
          ['return', 3],
        ]);
      });

      it('sends every event of a stream that threw', () => {
        const stream = createStream<number>();
        stream.next(1);
        stream.throw(new Error('failed'));
        const events = readEvents(roundTrip(stream));
        expect(events).toHaveLength(2);
        expect(events[0]).toEqual(['next', 1]);
        expect(events[1][0]).toBe('throw');
        assert(events[1][1] instanceof Error);
        expect(events[1][1].message).toBe('failed');
      });

      it('keeps references from an event to the stream', () => {
        const stream = createStream<unknown>();
        const shared = { name: 'shared' };
        stream.next(shared);
        stream.return({ stream, shared });
        const copy = roundTrip(stream);
        const events = readEvents(copy);
        const last = events[1][1] as { stream: unknown; shared: unknown };
        expect(last.stream).toBe(copy);
        expect(last.shared).toBe(events[0][1]);
      });

      it('rejects a stream that is still open', () => {
        const stream = createStream<number>();
        stream.next(1);
        expectUnsupported(() => roundTrip({ value: stream }), stream);
      });

      it('rejects a live stream', () => {
        const { stream } = createLiveStream<number>();
        expectUnsupported(() => roundTrip({ value: stream }), stream);
      });
    });
  }

  it('does not consume a live receiver', () => {
    const receiver = new Stream<number>(1);
    receiver.next(1);
    receiver.return(2);
    expect(readEvents(fromJSON(toJSON(receiver)))).toEqual([
      ['next', 1],
      ['return', 2],
    ]);
    // The receiver still replays to its first listener.
    expect(readEvents(receiver)).toEqual([
      ['next', 1],
      ['return', 2],
    ]);
  });

  it('rejects a live receiver that was consumed', () => {
    const receiver = new Stream<number>(1);
    receiver.next(1);
    receiver.return(2);
    readEvents(receiver);
    expectUnsupported(() => toJSON(receiver), receiver);
  });
});
