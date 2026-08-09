# seroval

> Serialize JS values into strings — cyclic references, deduplication, and dozens of built-in types

[![NPM](https://img.shields.io/npm/v/seroval.svg)](https://www.npmjs.com/package/seroval) [![JavaScript Style Guide](https://badgen.net/badge/code%20style/airbnb/ff5a5f?icon=airbnb)](https://github.com/airbnb/javascript) [![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/lxsmnsyc/seroval/badge)](https://scorecard.dev/viewer/?uri=github.com/lxsmnsyc/seroval)

`seroval` turns a live JavaScript value into a string you can embed in an HTML
`<script>` or send over the wire, then turn back into an equivalent value. It
goes well beyond `JSON.stringify`: cyclic and repeated references are preserved,
and a large set of built-in types round-trips faithfully.

## Features

- **Rich type support** — `Date`, `RegExp`, `Map`, `Set`, typed arrays,
  `ArrayBuffer`, `DataView`, `BigInt`, boxed primitives, `Error` /
  `AggregateError`, sparse arrays, well-known symbols, `Promise`,
  `ReadableStream`, async iterables, `Temporal`, and more.
- **References** — cyclic, self-referential and mutually-referential structures,
  plus deduplication of repeated values.
- **XSS-safe output** — strings are escaped so the result is safe to drop
  straight into a `<script>` tag.
- **Async & streaming** — await `Promise`s and drain streams while serializing,
  and flush the output chunk-by-chunk as values settle.
- **Multiple formats** — a JavaScript expression string (hydrated with `eval`),
  a plain JSON tree (rebuilt *without* `eval`, safe for untrusted transport), or
  a compact [binary format](https://github.com/lxsmnsyc/seroval/blob/main/docs/binary-mode-spec.md).
- **Extensible** — map non-serializable values (functions, class instances) by
  reference, or teach `seroval` new types with [plugins](https://github.com/lxsmnsyc/seroval/tree/main/packages/plugins).

## Install

```bash
npm install --save seroval
```

```bash
yarn add seroval
```

```bash
pnpm add seroval
```

## Usage

```js
import { serialize } from 'seroval';

const object = {
  number: [Math.random(), -0, NaN, Infinity, -Infinity],
  string: ['hello world', '<script>Hello World</script>'],
  boolean: [true, false],
  null: null,
  undefined: undefined,
  bigint: 9007199254740991n,
  array: [,,,], // holes
  regexp: /[a-z0-9]+/i,
  date: new Date(),
  map: new Map([['hello', 'world']]),
  set: new Set(['hello', 'world']),
};

// self cyclic references
// recursive objects
object.self = object;
// recursive arrays
object.array.push(object.array);
// recursive maps
object.map.set('self', object.map);
// recursive sets
object.set.add(object.set);

// mutual cyclic references
object.array.push(object.map);
object.map.set('mutual', object.set);
object.set.add(object.array);

const result = serialize(object);
console.log(result);
```

Output (as a string):

```js
((h,j,k,m,o)=>(o={number:[0.5337763749243287,-0,0/0,1/0,-1/0],string:["hello world","\x3Cscript>Hello World\x3C/script>"],boolean:[!0,!1],null:null,undefined:void 0,bigint:9007199254740991n,array:h=[,,,,k=(j=[],new Map([["hello","world"],["mutual",m=new Set(["hello","world"])]]))],regexp:/[a-z0-9]+/i,date:new Date("2023-12-07T17:28:57.909Z"),map:k,set:m},h[3]=h,k.set("self",k),m.add(m).add(h),o.self=o,o))()

// Formatted for readability
((h, j, k, m, o) => (
  (o = {
    number: [0.5337763749243287, -0, 0 / 0, 1 / 0, -1 / 0],
    string: ["hello world", "\x3Cscript>Hello World\x3C/script>"],
    boolean: [!0, !1],
    null: null,
    undefined: void 0,
    bigint: 9007199254740991n,
    array: (h = [
      ,
      ,
      ,
      ,
      (k =
        ((j = []),
        new Map([
          ["hello", "world"],
          ["mutual", (m = new Set(["hello", "world"]))],
        ]))),
    ]),
    regexp: /[a-z0-9]+/i,
    date: new Date("2023-12-07T17:28:57.909Z"),
    map: k,
    set: m,
  }),
  (h[3] = h),
  k.set("self", k),
  m.add(m).add(h),
  (o.self = o),
  o
))();
```

### Deserializing

`deserialize` evaluates the output back into a value. It runs the string as
JavaScript, so only pass output you produced from data you trust — see the JSON
tree API below for the untrusted case.

```js
import { serialize, deserialize } from 'seroval';

const result = serialize({ hello: 'world' });
const value = deserialize(result); // { hello: 'world' }
```

### Async values

`serializeAsync` awaits any `Promise` (and drains `ReadableStream` / async
iterables) reachable from the value before producing the string.

```js
import { serializeAsync, deserialize } from 'seroval';

const result = await serializeAsync(Promise.resolve({ hello: 'world' }));
const value = deserialize(result); // Promise<{ hello: 'world' }>
```

### JSON tree (safe transport)

`toJSON` / `fromJSON` use a plain, JSON-serializable tree instead of a
JavaScript string. `fromJSON` rebuilds the value **without** evaluating code, so
this is the pipeline to use when the payload crosses an untrusted boundary.

```js
import { toJSON, fromJSON } from 'seroval';

const tree = toJSON(new Map([['hello', 'world']]));
const text = JSON.stringify(tree); // send over the wire

const value = fromJSON(JSON.parse(text)); // Map(1) { 'hello' => 'world' }
```

There is a `toJSONAsync` for values containing `Promise`s.

### Streaming

`crossSerializeStream` emits the synchronous part of a value immediately, then
one chunk each time a `Promise` or stream resolves — ideal for progressively
flushing server-rendered data to a client.

```js
import { crossSerializeStream } from 'seroval';

const stop = crossSerializeStream(Promise.resolve('later'), {
  onSerialize(data) {
    // push `data` to the client as it becomes available
  },
  onDone() {
    // every pending value has settled
  },
});

// call stop() to abort early
```

### Plugins

Types `seroval` does not handle natively are covered by
[`seroval-plugins`](https://github.com/lxsmnsyc/seroval/tree/main/packages/plugins),
which ships adapters for many Web APIs (`Blob`, `File`, `FormData`, `Headers`,
`Request`, `Response`, `ReadableStream`, `URL`, and more).

```js
import { serializeAsync, deserialize } from 'seroval';
import { BlobPlugin } from 'seroval-plugins/web';

const result = await serializeAsync(new Blob(['hello']), {
  plugins: [BlobPlugin],
});
const value = deserialize(result); // Blob
```

You can also write your own with `createPlugin`.

### Targeting older runtimes

Every serializer accepts `disabledFeatures`, a bitmask of `Feature` flags, so
the output avoids syntax or globals a target runtime lacks. A value that needs a
disabled feature throws instead of being emitted.

```js
import { serialize, Feature } from 'seroval';

serialize(value, { disabledFeatures: Feature.Temporal });
```

## Docs

- [Serialization](https://github.com/lxsmnsyc/seroval/blob/main/docs/serialization.md)
- [Compatibility](https://github.com/lxsmnsyc/seroval/blob/main/docs/compatibility.md)
- [Isomorphic References](https://github.com/lxsmnsyc/seroval/blob/main/docs/isomorphic-refs.md)
- [Binary mode specification](https://github.com/lxsmnsyc/seroval/blob/main/docs/binary-mode-spec.md)

## Sponsors

![Sponsors](https://github.com/lxsmnsyc/sponsors/blob/main/sponsors.svg?raw=true)

## License

MIT © [lxsmnsyc](https://github.com/lxsmnsyc)
