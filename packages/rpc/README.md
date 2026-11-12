# `@seroval/rpc`

> Typed calls in both directions between two endpoints over a worker, a `MessagePort` or any other message connection

[![NPM](https://img.shields.io/npm/v/@seroval/rpc.svg)](https://www.npmjs.com/package/@seroval/rpc)

## Install

```bash
npm install --save seroval @seroval/transport @seroval/rpc
```

`seroval` and `@seroval/transport` are peer dependencies. `@seroval/rpc` is not on npm yet.

## Usage

```ts
// api.ts
import type { Channel } from '@seroval/rpc';

export type ProgressFunctions = {
  report(done: number, total: number): void;
};

export type SearchFunctions = {
  load(documents: string[], progress?: Channel<ProgressFunctions>): Promise<number>;
  search(word: string): Promise<string[]>;
};
```

```ts
// worker.ts
import { parentPort } from 'node:worker_threads';
import { createChannel, createEndpoint } from '@seroval/rpc';
import { fromNodeWorker } from '@seroval/rpc/node';
import type { SearchFunctions } from './api';

const documents: string[] = [];

const functions: SearchFunctions = {
  async load(items, progress) {
    for (const item of items) {
      documents.push(item);
      progress?.notify('report', documents.length, items.length);
    }
    return documents.length;
  },
  async search(word) {
    const result: string[] = [];
    for (const document of documents) {
      if (document.includes(word)) {
        result.push(document);
      }
    }
    return result;
  },
};

createEndpoint(fromNodeWorker(parentPort!)).serve(createChannel(functions));
```

```ts
// main.ts
import { Worker } from 'node:worker_threads';
import { createChannel, createEndpoint } from '@seroval/rpc';
import { fromNodeWorker } from '@seroval/rpc/node';
import type { ProgressFunctions, SearchFunctions } from './api';

const worker = new Worker(new URL('./worker.js', import.meta.url));
const search = createEndpoint(fromNodeWorker(worker)).connect<SearchFunctions>();

// The worker calls back through a channel in the arguments.
const progress = createChannel<ProgressFunctions>({
  report(done, total) {
    console.log(`${done} of ${total}`);
  },
});
await search.run('load', ['red apple pie', 'banana bread'], progress);
progress.close();

console.log(await search.run('search', 'apple')); // ['red apple pie']

// Closing the root closes both endpoints, and the worker exits.
search.close();
```

- `createChannel(functions)` makes a channel. `run(name, ...args)` calls a function and resolves with its result, and `notify(name, ...args)` does not wait.
- `createEndpoint(port)` ties channels to one port. `serve(channel)` exposes the root, and `connect()` returns the other side's root.
- `@seroval/rpc/node` adapts a `worker_threads` `Worker` or `parentPort`, and `@seroval/rpc/post-message` a web `Worker` or a `MessagePort`. Any object with `send` and `onMessage` works as a port.
- Arguments and results can hold promises, async iterables, channels and generators. Async iterables stream with a credit window, so a slow reader holds back the producer.
- A native generator in a value becomes a two-way `AsyncGenerator`. The value passed to `next(value)` reaches the `yield` on the other side.
- `channel.with({ signal }).run(...)` cancels a call when the signal aborts, and the called function sees `this.signal` abort. `createRpcSignal()` makes a signal with no Web API.
- Closing the root channel from either side closes both endpoints.
- A remote error arrives as `RpcRemoteError` with only its `name` and `message`.

See the [docs](https://seroval.vercel.app/docs/rpc) for the options, the close order, the errors and the limits.

## License

MIT © [lxsmnsyc](https://github.com/lxsmnsyc)
