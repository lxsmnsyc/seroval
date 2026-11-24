---
title: RPC reference
description: Every member and option of @seroval/rpc channels, endpoints and ports, its errors and its limits.
type: reference
---

This page lists the members and options of channels, endpoints and ports in `@seroval/rpc`, its errors and its limits. [RPC](../rpc.md) shows how to use them.

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
| `with({ signal })` | Returns a caller whose `run` and `notify` cancel when `signal` aborts. See [Cancelling](../rpc.md#cancelling). |
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
| `onCall(call, next)` | Wraps every incoming call. See [`onCall`](../rpc.md#oncall). |
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

## Related

- [RPC](../rpc.md)
- [RPC message format](./protocol.md)
- [Transport reference](../transport/reference.md)
