import { describe, expect, it } from 'vitest';
import { STREAM_CONSTRUCTOR } from '../src/core/constructors';
import { createStream, type StreamListener } from '../src/core/stream';

interface Target {
  on(listener: StreamListener<unknown>): () => void;
  next(value: unknown): void;
  throw(value: unknown): void;
  return(value: unknown): void;
}

function random(seed: number): () => number {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x80000000;
  };
}

// Every step, including reentrant work inside listeners, comes from the seed,
// so both implementations see the same operations in the same order. Each
// cleanup runs at most once.
function run(target: Target, seed: number): unknown[] {
  const rand = random(seed);
  const log: unknown[] = [];
  const cleanups: (() => void)[] = [];
  let depth = 0;
  const act = (id: number): void => {
    const pick = rand();
    if (pick < 0.3) {
      subscribe();
    } else if (pick < 0.55) {
      cleanups.splice(Math.floor(rand() * cleanups.length), 1)[0]?.();
    } else if (pick < 0.85) {
      target.next(id);
    } else if (pick < 0.93) {
      target.return(id);
    } else {
      target.throw(id);
    }
  };
  let ids = 0;
  const subscribe = (): void => {
    const id = ids++;
    const record =
      (mode: string) =>
      (value: unknown): void => {
        log.push(id, mode, value);
        if (depth < 3 && rand() < 0.3) {
          depth++;
          act(id * 100 + depth);
          depth--;
        }
      };
    cleanups.push(
      target.on({
        next: record('next'),
        throw: record('throw'),
        return: record('return'),
      }),
    );
  };
  for (let i = 0; i < 60; i++) {
    act(i);
  }
  subscribe();
  return log;
}

describe('Stream state', () => {
  it('matches the serialized stream constructor', () => {
    for (let seed = 1; seed <= 500; seed++) {
      expect(run(createStream(), seed)).toEqual(
        run(STREAM_CONSTRUCTOR() as Target, seed),
      );
    }
  });

  it('replays buffered values and the terminal event to late listeners', () => {
    const stream = createStream<number>();
    stream.next(1);
    stream.return(2);
    stream.next(3);
    const log: unknown[] = [];
    stream.on({
      next: value => log.push('next', value),
      throw: value => log.push('throw', value),
      return: value => log.push('return', value),
    });
    expect(log).toEqual(['next', 1, 'return', 2]);
  });

  it('keeps state private', () => {
    const stream = createStream();
    stream.on({
      next: () => undefined,
      throw: () => undefined,
      return: () => undefined,
    });
    stream.next(1);
    expect(Reflect.ownKeys(stream)).toEqual([]);
    expect(() => {
      createStream().next.call({}, 1);
    }).toThrow(TypeError);
  });
});
