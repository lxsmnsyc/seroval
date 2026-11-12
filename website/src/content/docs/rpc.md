---
title: RPC
description: Typed calls in both directions between two endpoints over a worker, a MessagePort or any other message connection with @seroval/rpc.
---

`@seroval/rpc` runs typed calls in both directions between two endpoints. Each side exposes functions on a channel, and the other side calls them by name. Arguments and results go through [`@seroval/transport`](./transport.md), so they can hold promises, streams, other channels and generators. The connection can be a `worker_threads` worker, a web `Worker`, a `MessagePort` or anything that sends messages.

```bash
npm install seroval @seroval/transport @seroval/rpc
```

`seroval` and `@seroval/transport` are peer dependencies.

| Entry point | Exports |
| --- | --- |
| `@seroval/rpc` | `createChannel`, `createEndpoint`, `createRpcSignal`, `RpcClosedError`, `RpcTransportError`, `RpcRemoteError`, and the types `Channel`, `Caller`, `CallContext`, `Functions`, `RemoteFunction`, `ChannelOptions`, `Endpoint`, `EndpointOptions`, `IncomingCall`, `Port`, `RpcSignal`, `RpcSignalController`. |
| `@seroval/rpc/node` | [`fromNodeWorker`](#ports), for a `worker_threads` `Worker` or `parentPort`. |
| `@seroval/rpc/post-message` | [`fromMessagePort`](#ports), for a web `Worker`, a `MessagePort` or the worker's own scope, and the type `MessagePortLike`. |

The core uses no Web or Node API. Only the two port entry points do.

## A search index in a worker

This example runs a search index in a `worker_threads` worker. The caller loads documents and hears about the progress, runs a query, cancels a call, drives a generator, and closes the worker.

The functions of each channel are a type that both sides import:

```ts
// api.ts
import type { CallContext, Channel } from '@seroval/rpc';

/** The channel the caller passes to hear about progress. */
export type ProgressFunctions = {
  report(done: number, total: number): void;
};

/** The root channel the worker serves. */
export type SearchFunctions = {
  load(documents: string[], progress?: Channel<ProgressFunctions>): Promise<number>;
  search(query: string): Promise<string[]>;
  scan(this: CallContext, query: string): Promise<string[]>;
  browse(query: string): AsyncGenerator<string, void, string | undefined>;
  quit(this: CallContext): void;
};
```

The worker makes a channel with the functions and serves it as the root:

```ts
// worker.ts
import { parentPort } from 'node:worker_threads';
import { createChannel, createEndpoint } from '@seroval/rpc';
import { fromNodeWorker } from '@seroval/rpc/node';
import type { SearchFunctions } from './api';

const documents: string[] = [];

function matchDocuments(query: string): string[] {
  const result: string[] = [];
  for (const document of documents) {
    let matches = true;
    for (const word of query.split(' ')) {
      matches &&= document.includes(word);
    }
    if (matches) {
      result.push(document);
    }
  }
  return result;
}

const functions: SearchFunctions = {
  async load(items, progress) {
    let done = 0;
    for (const item of items) {
      documents.push(item);
      done++;
      progress?.notify('report', done, items.length);
    }
    return documents.length;
  },
  async search(query) {
    return matchDocuments(query);
  },
  async scan() {
    // Runs until the caller cancels or the endpoint closes.
    await new Promise<void>((resolve) => {
      if (this.signal.aborted) {
        resolve();
      } else {
        this.signal.onAbort(() => resolve());
      }
    });
    return [];
  },
  async *browse(query) {
    // Each value the caller passes to next() narrows the query by one word.
    let current = query;
    for (;;) {
      const matches = matchDocuments(current);
      if (matches.length === 0) {
        return;
      }
      const word = yield matches[0];
      if (word) {
        current = `${current} ${word}`;
      }
    }
  },
  quit() {
    // Closing the root channel closes the endpoint and the port.
    this.channel.close();
  },
};

const endpoint = createEndpoint(fromNodeWorker(parentPort!));
endpoint.serve(createChannel(functions));
```

The caller connects to the root and calls it:

```ts
// main.ts
import { Worker } from 'node:worker_threads';
import { createChannel, createEndpoint, createRpcSignal } from '@seroval/rpc';
import { fromNodeWorker } from '@seroval/rpc/node';
import type { ProgressFunctions, SearchFunctions } from './api';

const worker = new Worker(new URL('./worker.js', import.meta.url));
const endpoint = createEndpoint(fromNodeWorker(worker));
const search = endpoint.connect<SearchFunctions>();

// Progress comes back through a channel in the arguments.
const progress = createChannel<ProgressFunctions>({
  report(done, total) {
    console.log(`${done} of ${total}`);
  },
});
await search.run('load', ['red apple pie', 'green apple tart', 'apple cider'], progress);
progress.close();

console.log(await search.run('search', 'apple'));

// Cancel a call. The worker's this.signal aborts.
const controller = createRpcSignal();
const scanning = search.with({ signal: controller.signal }).run('scan', 'apple');
controller.abort(new Error('stop'));
await scanning.catch((error) => console.log(error.message)); // 'stop'

// A generator goes both ways: next(word) reaches the worker's yield.
const browse = await search.run('browse', 'apple');
console.log((await browse.next()).value); // 'red apple pie'
console.log((await browse.next('tart')).value); // 'green apple tart'
await browse.return();

// Close from this side. The worker closes its port and exits.
search.close();
await search.closed;
```

The worker can close too: `search.notify('quit')` closes the root from the worker side, and `search.closed` resolves on the caller.

## Channels

`createChannel(functions, options)` makes a channel that owns `functions`. The side that made it is the owner. A side that got it from `connect()` or inside a value is a holder.

```ts
const counter = createChannel({
  increment(by: number) {
    return by + 1;
  },
});
```

| Member | Description |
| --- | --- |
| `run(name, ...args)` | Calls `name` and resolves with its result. Arguments and the return type come from the function type. |
| `notify(name, ...args)` | Calls `name` and does not wait. It returns nothing, and a failure is dropped. |
| `with({ signal })` | Returns a caller whose `run` and `notify` cancel when `signal` aborts. See [Cancelling](#cancelling). |
| `close()` | Closes the channel for the owner and every holder. |
| `closed` | A promise that resolves once the channel closed, from either end. |

- Calls on one channel start on the owner in the order they were made.
- The owner can call its own channel. The call runs in place and does not go through the endpoint.
- Function names are strings passed to `run`, so a function may be called `run`, `notify`, `with` or `close`.
- The functions may be a `type`, an `interface` or `typeof` an object.
- `run` on a generator function returns a promise of the generator. Await it before the first `next()`.

`options.onClose()` runs once when the channel closes. Its returned promise is awaited before `closed` resolves. A throw is reported as an unhandled rejection and not rethrown.

Inside a function, `this` is a `CallContext`:

| Field | Description |
| --- | --- |
| `this.signal` | An `RpcSignal` that aborts when the caller cancels, the channel closes or the endpoint closes. It stays valid across `await`. |
| `this.channel` | The channel the call came in on, for example to close it. |

`this` is typed as `CallContext` in an object passed to `createChannel` with no annotation. In a separate type, write `this: CallContext` on the methods that use it, as `scan` and `quit` do above.

## The endpoint

`createEndpoint(port, options)` ties channels to one port. `options` is optional.

| Method | Description |
| --- | --- |
| `serve(channel)` | Makes `channel` the root, which the other side gets from `connect()`. It takes a channel made by `createChannel`, and only once. |
| `connect<T>()` | Returns the root channel the other side served, as a holder. It returns at once, and its calls wait until the other side calls `serve`. Each call returns the same channel. |
| `close()` | Closes every channel and the port. |

| Option | Description |
| --- | --- |
| `plugins` | seroval plugins for the values in calls and results. Both sides need the same plugins. |
| `onCall(call, next)` | Wraps every incoming call. See [`onCall`](#oncall). |
| `window` | The most stream items the other side may send before this side has consumed them. Defaults to 16. It must be a positive integer, or `createEndpoint` throws a `RangeError`. |

Each side can serve a root and connect to the other side's root, so calls go in both directions. `T` in `connect<T>()` is not checked against what the other side serves.

- `serve` throws a `TypeError` for a value not made by `createChannel`, an `RpcTransportError` when called twice, and an `RpcClosedError` after the endpoint closed.
- Calls that arrive before `serve` wait for it.
- After `serve`, a call to a channel this side does not own fails with `RpcClosedError`. A notify to one is dropped.

## Ports

A `Port` is the only thing the core knows about the connection:

```ts
interface Port {
  send(message: unknown): void;
  onMessage(listener: (message: unknown) => void): () => void;
  onError?(listener: (error: unknown) => void): () => void;
  onClose?(listener: () => void): () => void;
  close?(): void;
}
```

| Member | Description |
| --- | --- |
| `send(message)` | Sends one message. A throw fails the endpoint with `RpcTransportError`. |
| `onMessage(listener)` | Passes on each message, and returns a function that stops listening. Buffer messages until a listener attaches, as a `MessagePort` does, or the first message is lost. |
| `onError(listener)` | Optional. A failure of the connection fails the endpoint with `RpcTransportError`. |
| `onClose(listener)` | Optional. The other end went away. The endpoint closes and calls in flight fail with `RpcClosedError`. Without it, calls in flight wait when the other end goes away. |
| `close()` | Optional. Called when the endpoint closes. |

Messages are plain arrays of numbers, strings, `null` and `SerovalNode` objects, so `postMessage` sends them as is. For a WebSocket, send `JSON.stringify(message)` and pass on `JSON.parse(event.data)`.

`fromNodeWorker(source)` from `@seroval/rpc/node` adapts a `worker_threads` `Worker` or `parentPort`:

- `error` and `messageerror` events go to `onError`, and `exit` and `close` to `onClose`.
- `close()` closes a `MessagePort` such as `parentPort`. It does not call `worker.terminate()`, since that would drop messages still on the way. The worker closes its own port when its endpoint closes, and then exits.

`fromMessagePort(source)` from `@seroval/rpc/post-message` adapts a web `Worker`, a `MessagePort` or the worker's own scope (`self`):

- It calls `start()` on a `MessagePort`, so messages reach the listener.
- `error` and `messageerror` events go to `onError`. A `close` event goes to `onClose`. A `MessagePort` has one, but a web `Worker` does not.
- `close()` calls `source.close()` when the source has it.

## Cancelling

`channel.with({ signal })` returns a caller whose calls cancel when `signal` aborts. The signal is an `RpcSignal`, which needs no Web API. `createRpcSignal()` makes one:

```ts
const controller = createRpcSignal();
const pending = channel.with({ signal: controller.signal }).run('scan', 'apple');
controller.abort(new Error('stop'));
await pending; // rejects with the Error('stop')
```

- The cancelled `run` rejects with the signal's reason.
- On the other side, `this.signal` aborts with an `RpcClosedError`, the streams in the arguments stop, and no result is sent back.
- A signal that already aborted stops the call before it goes out.
- `with` takes any object with `aborted`, `reason` and `onAbort(listener)`. To use an `AbortSignal`, call `controller.abort(signal.reason)` from its `abort` event.
- `onAbort(listener)` returns a function that removes the listener. A listener added after the abort is not called, so check `aborted` first.
- A call the owner makes on its own channel rejects, but the function's `this.signal` does not abort.

## Streams and the credit window

An async iterable in an argument or a result streams to the other side while the call runs. Each side tells the other its `window` when the endpoint starts:

- The writer sends at most `window` stream items of a value that the reader has not consumed. Then it holds the source back.
- The reader gives credit back as the code that reads the stream takes items. Credit goes in batches of half the window, rounded down, and at least 1.
- Leaving a stream early with `break`, `return()` or `throw()` stops the source on the other side.
- An error the source throws reaches the reader as an `RpcRemoteError` with only the name and message. A transport failure reaches it as an `RpcTransportError`, and a close as an `RpcClosedError`.

```ts
const producer = createChannel({
  numbers() {
    // A plain async iterable streams one way, with the window.
    return {
      async *[Symbol.asyncIterator]() {
        for (let i = 0; ; i++) {
          yield i;
        }
      },
    };
  },
});
```

A native generator or async generator in a value does not stream this way. It becomes a [two-way generator](#two-way-generators). Wrap it in a plain object with `Symbol.asyncIterator`, as above, to get the one-way stream with the window.

## Channels in values

A channel made by `createChannel` can go in an argument or a result. The other side gets a holder and can call it, as the progress channel does in the example.

- The channel goes out as its ID. The endpoint keeps it until the channel closes.
- A channel that arrives twice is the same holder both times.
- Close it when you no longer need it, from either end. Both sides then see `closed` resolve, and the owner's `onClose` runs once.

## Two-way generators

A native generator or async generator in an argument or a result becomes an `AsyncGenerator` on the other side. The value passed to `next(value)` reaches the `yield` expression, and `throw(error)` and `return(value)` reach the generator.

```ts
const browse = await search.run('browse', 'apple');
await browse.next(); // starts the generator; the value of the first next() is ignored
await browse.next('tart'); // 'tart' is the result of the worker's yield
await browse.return(); // runs the worker's finally
```

- A sync generator becomes an async one.
- Each step is one round trip. There is no credit window.
- `break` in a `for await` loop sends `return`, so the generator's `finally` runs.
- An error the generator throws arrives as an `RpcRemoteError`. An error passed to `throw(error)` reaches the generator as a seroval copy.
- A received generator can be sent on to another call. Each hop adds a round trip per step.
- The receiver closes the generator's hidden channel once a step is done or fails. To close it early, call `return()` or leave the loop.

## Closing

Closing the root channel closes the endpoint on both sides. `close()` on either end, `endpoint.close()`, a port `onClose` and a transport failure all close the endpoint.

When an endpoint closes, it:

1. Stops taking messages.
2. Fails the calls in flight and aborts the `this.signal` of the calls running on this side.
3. Closes the channels it holds, and tells the other side while the port is open.
4. Closes the channels it owns: the nested ones in the reverse order they were sent, and the root last.
5. Stops the streams it sends and fails the streams it reads.
6. Runs `onClose` one channel at a time, in the order of step 4, and calls `port.close()`.

A throwing `onClose` is reported as an unhandled rejection, and the rest still run. After a close, `run` rejects with `RpcClosedError` and handles its own rejection, so an ignored call causes no unhandled rejection.

## `onCall`

`onCall(call, next)` wraps every call that arrives from the other side. `call` holds `name`, `args` and `context` (the `this` of the function). Call `next()` to run the function. What `onCall` returns or throws is the result.

```ts
const endpoint = createEndpoint(port, {
  async onCall(call, next) {
    if (call.name === 'admin') {
      throw new Error('Not allowed');
    }
    const start = Date.now();
    try {
      return await next();
    } finally {
      console.log(call.name, Date.now() - start);
    }
  },
});
```

- It runs for the calls on every channel this side owns, including the steps of a generator it sent (`next`, `throw` and `return`).
- It does not run for a call the owner makes on its own channel.

## Errors

| Error | When |
| --- | --- |
| `RpcClosedError` | The channel or the endpoint closed before the call finished, or the port closed. It is also the reason of `this.signal` when the caller cancels or the endpoint closes. |
| `RpcTransportError` | The port failed, the arguments of a call cannot be sent, or the other side sent a message rpc cannot read, including a different protocol version. |
| `RpcRemoteError` | The function threw on the other side, or its result cannot be sent. `remoteName` holds the remote error's `name`. |

Only `name` and `message` of a remote error cross, never the stack, the cause or other fields. A remote error named `RpcClosedError` arrives as `RpcClosedError`, and any other as `RpcRemoteError`. A thrown value that is not an object arrives with the name `Error` and the value as text.

A failure of the transport fails every call in flight with the same `RpcTransportError`, and closes the endpoint.

## Limits

Streams:

- A result stream the caller never reads stays held on the other side until the endpoint closes. Its producer stops after `window` items. Read it, call `return()` on it, or cancel the call.
- Streams get the window only inside arrays, plain objects, maps and sets. A stream anywhere else, such as inside a plugin value, stops after `window` items.
- A cancel for a call that still waits for `serve` is lost, and the call runs. A `notify` cannot be cancelled.
- The window counts seroval's `StreamNext` nodes (node type 32), which seroval does not export.

Channels:

- A channel sent and never closed stays in the endpoint until the endpoint closes. Close it from either end.
- A channel received from the other side cannot be sent back to it. Only channels made by `createChannel` cross, so the call fails.
- A call to a channel ID this side does not own waits when the endpoint never called `serve`.
- Calls that wait for `serve` have no limit on their number.

Generators:

- Every native generator and async generator in a value is two-way, with one round trip per step and no window. There is no marker to send one as a one-way stream. Wrap it in a plain async iterable instead.
- A receiver that drops a generator without `return()` leaves its hidden channel in the endpoint until the endpoint closes.
- Closing an endpoint sends no close message for the channels it owns. The other side learns through `Port.onClose`. With a port that has no `onClose`, such as `fromMessagePort` on a web `Worker`, a pending `next()` keeps waiting.

Other:

- Buffers are copied into the message. There is no transfer of an `ArrayBuffer` to the other side.
- `endpoint.close(reason)` ignores the reason. Calls in flight fail with `RpcClosedError`.
- A channel is not closed when it is garbage collected.

## Message format

rpc sends the [transport messages](./transport.md#message-format) `0`, `1` and `2` for values, and these control messages beside them:

| Message | Meaning |
| --- | --- |
| `[3, version, rootId, window]` | Hello. Sent when the endpoint starts with `rootId` `null`, and again on `serve` with the root's ID. `window` is the sender's read window. |
| `[4, key, n]` | Credit. The reader consumed `n` more stream items of the value under `key`. |
| `[5, key]` | The reader left the value under `key`, so the writer stops its sources. |
| `[6, id, side]` | Close the channel `id`. `side` is `0` when a holder closed it and `1` when the owner did. |
| `[7, key]` | The caller cancelled the call under `key`. |

A call is the value `[channelId, name, args]`, with a `1` after them for a notify. A result is `[callKey, value]`, and a failure is `[callKey, { name, message }, 1]`. The protocol version is 1, and an endpoint that receives another version fails with `RpcTransportError`.
