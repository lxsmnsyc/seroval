---
title: Cross-reference serialization
description: Share references between separate scripts with crossSerialize, refs and scopeId.
---

`serialize` makes each result self-contained. Two calls that include the same object each send their own copy. Cross-reference serialization lets several scripts share values instead: a later script can refer back to a value an earlier script already sent.

## How it works

Cross-reference output stores each value in a global array named `$R`. A `refs` map records which values have been sent, and at which index. Pass the same map to every call.

```js
import { crossSerialize } from 'seroval';

const a = {};
const b = {};
a.next = b;
b.prev = a;

const refs = new Map();

crossSerialize(a, { refs });
// ($R[0]={next:$R[1]={}},$R[1].prev=$R[0],$R[0])

crossSerialize(b, { refs });
// $R[1]
```

The second call sends nothing new. `b` was already sent as `$R[1]`, so the output only refers to it.

## Declaring $R

The output expects `$R` to exist before it runs. `getCrossReferenceHeader` returns a script that creates it. Send the header once, before the first script.

```js
import { getCrossReferenceHeader } from 'seroval';

getCrossReferenceHeader(); // self.$R=self.$R||[]
```

## Scoping with scopeId

Without a scope, every script on the page shares one `$R` array. When several independent sources write to the same page, give each one a `scopeId`. Its output then uses its own array, `$R[scopeId]`.

```js
const refs = new Map();

crossSerialize(a, { refs, scopeId: 'app' });
// ($R=>($R[0]={next:$R[1]={}},$R[1].prev=$R[0],$R[0]))($R["app"])

getCrossReferenceHeader('app'); // (self.$R=self.$R||{})["app"]=[]
```

Each scope needs its own `refs` map, and its own header.

## Functions

| Function | Output |
| --- | --- |
| `crossSerialize(value, options?)` | A script, for synchronous values. |
| `crossSerializeAsync(value, options?)` | A script, after promises and streams finish. |
| `crossSerializeStream(value, options)` | One script per chunk. See [Streaming](./streaming.md). |
| `toCrossJSON(value, options?)` | A JSON node. |
| `toCrossJSONAsync(value, options?)` | A JSON node, after promises and streams finish. |
| `toCrossJSONStream(value, options)` | One JSON node per chunk. |
| `fromCrossJSON(node, options)` | Rebuilds a value from a JSON node. |

They take the same options as [`serialize`](./javascript-output.md#options), plus:

| Option | Description |
| --- | --- |
| `refs` | A `Map` of the values already sent. Share it between calls. |
| `scopeId` | Writes to `$R[scopeId]` instead of the global `$R`. JavaScript output only. |
| `assignSharedRefsOnly` | `crossSerialize` and `crossSerializeAsync` only. Writes `$R[n]=` only for values the output reads more than once. See [Shared references only](#shared-references-only). |

## Shared references only

By default, cross-reference output stores every object in `$R`, because a later script may refer to it. If no later script will refer back to this output, set `assignSharedRefsOnly`. The output then stores only the values it reads more than once, such as shared objects and cycles. It is shorter and faster to make.

```js
crossSerialize({ a: { b: [1] } });
// ($R[0]={a:$R[1]={b:$R[2]=[1]}})

crossSerialize({ a: { b: [1] } }, { assignSharedRefsOnly: true });
// ({a:{b:[1]}})
```

The output can still read values that earlier scripts stored, through `refs`. Do not set the option if a later call with the same `refs` may refer to values in this output. Those values are not in `$R`, so the later script would read `undefined`.

## Decoding cross-reference JSON

`fromCrossJSON` is the JSON counterpart of running the scripts. Its `refs` option is a `Map` from index to value. Pass the same map to every call, so later nodes can refer to earlier ones.

```js
import { fromCrossJSON, toCrossJSON } from 'seroval';

const sendRefs = new Map();
const first = toCrossJSON(a, { refs: sendRefs });
const second = toCrossJSON(b, { refs: sendRefs });

const receiveRefs = new Map();
const copyA = fromCrossJSON(first, { refs: receiveRefs });
const copyB = fromCrossJSON(second, { refs: receiveRefs });
copyA.next === copyB; // true
```

`fromCrossJSON` requires its options argument. Pass `{}` if you have none.
