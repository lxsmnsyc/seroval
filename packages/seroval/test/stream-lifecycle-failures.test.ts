import { describe, expect, it, vi } from 'vitest';
import {
  createLiveStream,
  createPlugin,
  createStream,
  crossSerializeStream,
  Serializer,
  type SerovalNode,
  SerovalParserError,
  SerovalUnsupportedTypeError,
  type StreamParsePluginContext,
  toCrossJSONStream,
  toJSON,
} from '../src';
import {
  createStreamParserContext,
  destroyStreamParse,
  startStreamParse,
} from '../src/core/context/stream-parser';

const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));
function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('fatal streaming failures', () => {
  it('keeps JavaScript callbacks with incidental non-thenable returns synchronous', () => {
    const events: string[] = [];
    // Reflect.apply exercises the JavaScript call contract without pretending
    // that the TypeScript callback declaration permits a numeric return.
    Reflect.apply(crossSerializeStream, undefined, [
      1,
      {
        onSerialize() {
          return events.push('output');
        },
        onDone() {
          events.push('done');
        },
      },
    ]);
    expect(events).toEqual(['output', 'done']);
  });

  it('does not inspect then on primitive callback results', () => {
    for (const value of [0, 1, false, true, '', 'text']) {
      const prototype = Object.getPrototypeOf(new Object(value));
      const previous = Object.getOwnPropertyDescriptor(prototype, 'then');
      const events: string[] = [];
      let reads = 0;
      Object.defineProperty(prototype, 'then', {
        configurable: true,
        get() {
          reads++;
          throw new Error('Primitive prototype then was read');
        },
      });
      try {
        Reflect.apply(crossSerializeStream, undefined, [
          1,
          {
            onSerialize() {
              events.push('output');
              return value;
            },
            onDone() {
              events.push('done');
            },
          },
        ]);
      } finally {
        if (previous) {
          Object.defineProperty(prototype, 'then', previous);
        } else {
          Reflect.deleteProperty(prototype, 'then');
        }
      }
      expect(reads).toBe(0);
      expect(events).toEqual(['output', 'done']);
    }
  });

  it('calls a thenable without reading its call property', async () => {
    const onError = vi.fn();
    const onDone = vi.fn();
    const then = (resolve: () => void) => resolve();
    Object.defineProperty(then, 'call', {
      get() {
        throw new Error('The callable then must not expose its call property');
      },
    });
    crossSerializeStream(1, {
      onSerialize() {
        return Object.defineProperty({}, 'then', {
          value: then,
        }) as PromiseLike<void>;
      },
      onError,
      onDone,
    });
    await tick();
    expect(onError).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('observes a returned rejection after cancellation inside output', async () => {
    const reason = new Error('cancelled');
    const channel = createLiveStream<number>();
    const onError = vi.fn();
    const onDone = vi.fn();
    const dispose = crossSerializeStream(channel.stream, {
      onSerialize(_value, initial) {
        if (!initial) {
          dispose(reason);
          return Promise.reject(new Error('late rejection'));
        }
        return undefined;
      },
      onError,
      onDone,
    });
    await expect(channel.producer.write(1)).rejects.toBe(reason);
    await tick();
    expect(onError).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('releases the parser cancellation reason after replay cleanup, including cleanup failure', () => {
    const reason = { owner: new Uint8Array(16) };
    const cleanupError = new Error('cleanup');
    const ctx = createStreamParserContext({ onParse: () => undefined });
    startStreamParse(ctx, createStream());
    ctx.state.cleanups.push(() => {
      expect(ctx.state.reason).toBe(reason);
      throw cleanupError;
    });
    expect(() => destroyStreamParse(ctx, reason)).toThrow(cleanupError);
    expect(ctx.state.reason).toBeUndefined();
  });

  it('keeps the reason through late cleanup in a synchronous parse unwind', async () => {
    const reason = new Error('parse stopped');
    const channel = createLiveStream<number>();
    const token = {};
    const seen: unknown[] = [];
    const plugin = createPlugin<object, Record<string, never>>({
      tag: 'reason-unwind',
      test: value => value === token,
      parse: {
        stream(_value, pluginCtx) {
          pluginCtx.parse(channel.stream);
          pluginCtx.onError(reason);
          pluginCtx.addCleanup(() => seen.push(ctx.state.reason));
          return {};
        },
      },
      serialize: () => '({})',
      deserialize: () => token,
    });
    const ctx = createStreamParserContext({
      plugins: [plugin],
      onParse: () => undefined,
      onError: () => undefined,
    });
    startStreamParse(ctx, token);
    expect(seen).toEqual([reason]);
    expect(ctx.state.reason).toBeUndefined();
    // The live producer owns its own reason for subsequent operations.
    await expect(channel.producer.write(1)).rejects.toBe(reason);
  });

  it('keeps the reason through late cleanup inside a synchronous output callback', () => {
    const reason = new Error('output stopped');
    const token = {};
    const seen: unknown[] = [];
    let pluginCtx!: StreamParsePluginContext;
    const plugin = createPlugin<object, Record<string, never>>({
      tag: 'output-reason',
      test: value => value === token,
      parse: {
        stream(_value, current) {
          pluginCtx = current;
          return {};
        },
      },
      serialize: () => '({})',
      deserialize: () => token,
    });
    const ctx = createStreamParserContext({
      plugins: [plugin],
      onParse() {
        destroyStreamParse(ctx, reason);
        pluginCtx.addCleanup(() => seen.push(ctx.state.reason));
      },
    });
    startStreamParse(ctx, token);
    expect(seen).toEqual([reason]);
    expect(ctx.state.reason).toBeUndefined();
  });

  it('preserves the no-handler Serializer parsing error', () => {
    const writer = new Serializer({
      globalIdentifier: 'X',
      onData: () => undefined,
    });
    expect(() => writer.write('bad', () => undefined)).toThrow(
      SerovalParserError,
    );
    expect(() => writer.write('after', 1)).not.toThrow();
    expect([...writer.keys]).toEqual(['bad']);
  });

  it.each(['absent', 'throws'] as const)(
    'preserves the primary error when cleanup also throws and the handler %s',
    mode => {
      const cleanupError = new Error('cleanup failed');
      const handlerError = new Error('handler failed');
      const cleaned: number[] = [];
      const sources = [0, 1].map(index => {
        const source = createStream<number>();
        const subscribe = source.on;
        source.on = listener => {
          const off = subscribe(listener);
          return () => {
            off();
            cleaned.push(index);
            if (index === 0) {
              throw cleanupError;
            }
          };
        };
        return source;
      });
      const onDone = vi.fn();
      const writer = new Serializer({
        globalIdentifier: 'X',
        onData: () => undefined,
        onDone,
        onError:
          mode === 'throws'
            ? () => {
                throw handlerError;
              }
            : undefined,
      });
      writer.write('first', sources[0]);
      writer.write('second', sources[1]);
      let thrown: unknown;
      try {
        writer.write('bad', () => undefined);
      } catch (error) {
        thrown = error;
      }
      if (mode === 'absent') {
        expect(thrown).toBeInstanceOf(SerovalParserError);
        if (thrown instanceof SerovalParserError) {
          expect(thrown.cause).toBeInstanceOf(SerovalUnsupportedTypeError);
        }
      } else {
        expect(thrown).toBe(handlerError);
      }
      expect(cleaned).toEqual([0, 1]);
      expect(onDone).not.toHaveBeenCalled();
      expect(() => writer.close()).not.toThrow();
    },
  );

  it('stops a held Serializer after output failure without successful completion', () => {
    const failure = new Error('writer output');
    const onDone = vi.fn();
    const onError = vi.fn();
    const onData = vi.fn(() => {
      throw failure;
    });
    const writer = new Serializer({
      globalIdentifier: 'data',
      onData,
      onDone,
      onError,
    });
    writer.write('first', 1);
    expect(onError).toHaveBeenCalledExactlyOnceWith(failure);
    writer.write('late', 2);
    writer.flush();
    writer.close();
    expect(onData).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
  });
  it.each(['throw', 'reject', 'getter', 'serialize', 'parse'] as const)(
    'rejects producer with the reported %s reason',
    async kind => {
      const failure = new Error(kind);
      const onCancel = vi.fn();
      const onError = vi.fn();
      const onDone = vi.fn();
      const { stream, producer } = createLiveStream<unknown>({ onCancel });
      const token = {};
      const plugin = createPlugin<object, Record<string, never>>({
        tag: 'fatal',
        test: value => value === token,
        parse: {
          stream() {
            if (kind === 'parse') {
              throw failure;
            }
            return {};
          },
        },
        serialize() {
          throw failure;
        },
        deserialize() {
          return token;
        },
      });
      const dispose = crossSerializeStream(stream, {
        plugins: [plugin],
        onDone,
        onError,
        onSerialize(_value, initial) {
          if (initial) {
            return;
          }
          if (kind === 'throw') {
            throw failure;
          }
          if (kind === 'reject') {
            return Promise.reject(failure);
          }
          if (kind === 'getter') {
            return Object.defineProperty({}, 'then', {
              get() {
                throw failure;
              },
            }) as PromiseLike<void>;
          }
          return undefined;
        },
      });
      let reason: unknown = 'pending';
      const pending = producer.write(
        kind === 'serialize' || kind === 'parse' ? token : 1,
      );
      pending.then(
        () => {
          reason = 'accepted';
        },
        error => {
          reason = error;
        },
      );
      await tick();
      await tick();
      expect(reason).not.toBe('pending');
      expect(reason).not.toBe('accepted');
      expect(onError).toHaveBeenCalledTimes(1);
      expect(reason).toBe(onError.mock.calls[0][0]);
      expect(onCancel).toHaveBeenCalledExactlyOnceWith(reason);
      expect(onDone).not.toHaveBeenCalled();
      dispose();
    },
  );

  it('forwards optional disposal reason while root is pending, without onDone', async () => {
    const root = gate();
    const onCancel = vi.fn();
    const onDone = vi.fn();
    const { stream, producer } = createLiveStream<number>({ onCancel });
    let synchronous = false;
    const dispose = crossSerializeStream(stream, {
      onSerialize() {
        synchronous = true;
        return root.promise;
      },
      onDone,
    });
    expect(synchronous).toBe(true);
    const pending = producer.write(1);
    const reason = new Error('cancel');
    const rejected = expect(pending).rejects.toBe(reason);
    dispose(reason);
    await rejected;
    expect(onCancel).toHaveBeenCalledExactlyOnceWith(reason);
    expect(onDone).not.toHaveBeenCalled();
    root.resolve();
    await tick();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('restores every streaming plugin method and immediately runs late cleanups', () => {
    const methods = [
      'parse',
      'parseWithError',
      'isAlive',
      'pushPendingState',
      'popPendingState',
      'onParse',
      'onError',
      'addCleanup',
    ];
    const first = vi.fn();
    const second = vi.fn();
    const late = vi.fn();
    const failure = new Error('plugin stop');
    const observed: boolean[] = [];
    const plugin = createPlugin<object, Record<string, never>>({
      tag: 'context',
      test: () => true,
      parse: {
        stream(_value, ctx) {
          for (const name of methods) {
            expect(typeof Reflect.get(ctx, name)).toBe('function');
          }
          ctx.pushPendingState();
          ctx.addCleanup(first);
          ctx.addCleanup(second);
          ctx.onError(failure);
          observed.push(ctx.isAlive());
          ctx.addCleanup(late);
          return {};
        },
      },
      serialize: () => '({})',
      deserialize: () => ({}),
    });
    const onError = vi.fn();
    const onParse = vi.fn();
    const onDone = vi.fn();
    toCrossJSONStream({}, { plugins: [plugin], onError, onParse, onDone });
    expect(observed).toEqual([false]);
    expect(onError).toHaveBeenCalledExactlyOnceWith(failure);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(late).toHaveBeenCalledTimes(1);
    expect(onParse).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('runs all cleanup when error handlers reenter and throw; preserves external refs', () => {
    const failure = new Error('output');
    const handlerError = new Error('handler');
    const cleanupError = new Error('cleanup');
    const refs = new Map<unknown, number>();
    const source = createStream<number>();
    const ctx = createStreamParserContext({
      refs,
      onParse() {
        throw failure;
      },
      onError() {
        expect(ctx.state.alive).toBe(false);
        throw handlerError;
      },
    });
    const calls: number[] = [];
    ctx.state.cleanups.push(
      () => {
        calls.push(1);
        throw cleanupError;
      },
      () => {
        calls.push(2);
      },
    );
    expect(() => startStreamParse(ctx, source)).toThrow();
    expect(calls).toEqual([1, 2]);
    expect(refs.has(source)).toBe(true);
    expect(ctx.state.alive).toBe(false);
    expect(ctx.state.queue).toEqual([]);
    expect(ctx.state.onParse).toBeUndefined();
    expect(ctx.state.onError).toBeUndefined();
    expect(ctx.state.onDone).toBeUndefined();
  });

  it('does not accept a record after cancellation inside output', async () => {
    const { stream, producer } = createLiveStream<number>();
    const reason = new Error('stop');
    const dispose = toCrossJSONStream(stream, {
      onParse(_node, initial) {
        if (!initial) {
          dispose(reason);
        }
      },
    });
    await expect(producer.write(1)).rejects.toBe(reason);
  });

  it('keeps child plugin records behind their root gate', async () => {
    const root = gate();
    const seen: SerovalNode[] = [];
    const plugin = createPlugin<object, Record<string, never>>({
      tag: 'records',
      test: () => true,
      parse: {
        stream(_value, ctx) {
          ctx.onParse(toJSON(2).t);
          expect(ctx.parseWithError(1)).toEqual(toJSON(1).t);
          return {};
        },
      },
      serialize: () => '({})',
      deserialize: () => ({}),
    });
    toCrossJSONStream(
      {},
      {
        plugins: [plugin],
        onParse(node, initial) {
          seen.push(node);
          if (initial) {
            return root.promise;
          }
          return undefined;
        },
      },
    );
    expect(seen).toHaveLength(1);
    root.resolve();
    await tick();
    expect(seen).toHaveLength(2);
    expect(seen[1]).toEqual(toJSON(2).t);
  });

  it('releases a synchronously replayed subscription even when reporting throws', () => {
    const source = createStream<unknown>();
    source.next(() => undefined);
    const original = source.on;
    let subscribed = false;
    source.on = listener => {
      subscribed = true;
      const off = original(listener);
      return () => {
        subscribed = false;
        off();
      };
    };
    const handlerError = new Error('report failed');
    expect(() =>
      toCrossJSONStream(source, {
        onParse: () => undefined,
        onError() {
          throw handlerError;
        },
      }),
    ).toThrow(handlerError);
    expect(subscribed).toBe(false);
  });

  it('does not reenter output while a synchronous root callback creates a child', async () => {
    const source = createStream<number>();
    const root = gate();
    const sequence: string[] = [];
    const dispose = toCrossJSONStream(source, {
      onParse(_node, initial) {
        if (initial) {
          sequence.push('root:start');
          source.next(1);
          sequence.push('root:end');
          return root.promise;
        }
        sequence.push('child');
        return undefined;
      },
    });
    expect(sequence).toEqual(['root:start', 'root:end']);
    root.resolve();
    await tick();
    expect(sequence).toEqual(['root:start', 'root:end', 'child']);
    dispose();
  });

  it('uses the same thrown fallback error for cancellation when no error callback exists', async () => {
    const onCancel = vi.fn();
    const { stream, producer } = createLiveStream<number>({ onCancel });
    const pending = producer.write(1);
    let rejected: unknown;
    pending.catch(error => {
      rejected = error;
    });
    let thrown: unknown;
    try {
      crossSerializeStream(stream, {
        onSerialize() {
          throw new Error('root output');
        },
      });
    } catch (error) {
      thrown = error;
    }
    await tick();
    expect(thrown).toBeInstanceOf(Error);
    expect(rejected).toBe(thrown);
    expect(onCancel).toHaveBeenCalledExactlyOnceWith(thrown);
  });

  it('keeps caller-held delivery.event valid after acceptance', async () => {
    const channel = createLiveStream<object>();
    const consumer = channel.stream.consume();
    const value = {};
    const pending = channel.producer.write(value);
    const delivery = await consumer.read();
    const event = delivery.event;
    delivery.accept();
    await pending;
    expect(delivery.event).toBe(event);
    expect(delivery.event).toEqual({ type: 'next', value });
    delivery.accept();
    consumer.cancel();
  });

  it('cancels every pending producer even when one cancellation callback throws', async () => {
    const cleanupError = new Error('cancel callback');
    const reason = new Error('transport stopped');
    const first = createLiveStream<number>({
      onCancel() {
        throw cleanupError;
      },
    });
    const secondCancel = vi.fn();
    const second = createLiveStream<number>({ onCancel: secondCancel });
    const root = gate();
    const dispose = toCrossJSONStream([first.stream, second.stream], {
      onParse() {
        return root.promise;
      },
    });
    const one = expect(first.producer.write(1)).rejects.toBe(reason);
    const two = expect(second.producer.write(2)).rejects.toBe(reason);
    expect(() => dispose(reason)).toThrow(cleanupError);
    await Promise.all([one, two]);
    expect(secondCancel).toHaveBeenCalledExactlyOnceWith(reason);
    root.resolve();
    await tick();
  });
});
