import v8 from 'node:v8';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
  createLiveStream,
  createStream,
  crossSerializeStream,
  fromCrossJSON,
  type SerovalNode,
  type Stream,
  toCrossJSONStream,
} from '../src';
import { STREAM_CONSTRUCTOR } from '../src/core/constructors';

v8.setFlagsFromString('--expose-gc');
const gc = vm.runInNewContext('gc') as () => void;

function tick(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function listen<T>(stream: Stream<T>, into: T[]): () => void {
  return stream.on({
    next(value) {
      into.push(value);
    },
    return(value) {
      into.push(value);
    },
    throw(value) {
      into.push(value as T);
    },
  });
}

describe('live receiver', () => {
  it('replays history to its first listener, then forwards without retaining', async () => {
    const receiver = STREAM_CONSTRUCTOR(1) as unknown as Stream<object>;
    const refs: WeakRef<object>[] = [];
    function push(i: number): void {
      const value = { i };
      refs.push(new WeakRef(value));
      receiver.next(value);
    }
    push(0);
    const seen: object[] = [];
    listen(receiver, seen);
    expect(seen).toHaveLength(1);
    push(1);
    push(2);
    expect(seen).toHaveLength(3);
    seen.length = 0;
    await tick();
    gc();
    await tick();
    gc();
    expect(refs.map(ref => ref.deref())).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    receiver.return({ i: 3 });
  });

  it('refuses a second listener', () => {
    const receiver = STREAM_CONSTRUCTOR(1) as unknown as Stream<number>;
    listen(receiver, []);
    expect(() => listen(receiver, [])).toThrow('Stream consumed');
  });

  it('delivers the terminal event to a late first listener', () => {
    const receiver = STREAM_CONSTRUCTOR(1) as unknown as Stream<number>;
    receiver.next(1);
    receiver.return(2);
    const seen: number[] = [];
    listen(receiver, seen);
    expect(seen).toEqual([1, 2]);
  });

  it('keeps the replay receiver unchanged', () => {
    const receiver = STREAM_CONSTRUCTOR() as unknown as Stream<number>;
    receiver.next(1);
    const first: number[] = [];
    const second: number[] = [];
    listen(receiver, first);
    receiver.next(2);
    listen(receiver, second);
    receiver.return(3);
    expect(first).toEqual([1, 2, 3]);
    expect(second).toEqual([1, 2, 3]);
  });
});

describe('live receiver on the wire', () => {
  it('marks a live stream in JS output and leaves createStream alone', () => {
    const outputs: string[] = [];
    crossSerializeStream(createLiveStream<number>().stream, {
      onSerialize(data) {
        outputs.push(data);
      },
    });
    crossSerializeStream(createStream<number>(), {
      onSerialize(data) {
        outputs.push(data);
      },
    });
    expect(outputs[0].endsWith('(1)')).toBe(true);
    expect(outputs[1].endsWith('()')).toBe(true);
  });

  it('builds a live receiver from a marked node and a replay one otherwise', async () => {
    const { stream, producer } = createLiveStream<number>();
    const nodes: SerovalNode[] = [];
    const done = new Promise<void>((resolve, reject) => {
      toCrossJSONStream(stream, {
        onParse(node) {
          nodes.push(node);
        },
        onDone: resolve,
        onError: reject,
      });
    });
    await producer.write(1);
    await producer.close(2);
    await done;
    expect(nodes[0].l).toBe(1);

    const live = fromCrossJSON<Stream<number>>(nodes[0], { refs: new Map() });
    listen(live, []);
    expect(() => listen(live, [])).toThrow();

    const unmarked = { ...nodes[0], l: undefined };
    const replay = fromCrossJSON<Stream<number>>(unmarked, {
      refs: new Map(),
    });
    listen(replay, []);
    expect(() => listen(replay, [])).not.toThrow();

    const malformed = { ...nodes[0], l: 2 as 1 };
    const fallback = fromCrossJSON<Stream<number>>(malformed, {
      refs: new Map(),
    });
    listen(fallback, []);
    expect(() => listen(fallback, [])).not.toThrow();
  });

  it('round-trips live stream values through the live receiver', async () => {
    const { stream, producer } = createLiveStream<number>();
    const refs = new Map();
    let restored: Stream<number> | undefined;
    const done = new Promise<void>((resolve, reject) => {
      toCrossJSONStream(stream, {
        onParse(node, initial) {
          const value = fromCrossJSON<Stream<number>>(node, { refs });
          if (initial) {
            restored = value;
          }
        },
        onDone: resolve,
        onError: reject,
      });
    });
    const seen: number[] = [];
    await tick();
    listen(restored as Stream<number>, seen);
    await producer.write(1);
    await producer.write(2);
    await producer.close(3);
    await done;
    expect(seen).toEqual([1, 2, 3]);
  });
});
