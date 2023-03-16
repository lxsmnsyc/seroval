# seroval

> Stringify JS values

[![NPM](https://img.shields.io/npm/v/seroval.svg)](https://www.npmjs.com/package/seroval) [![JavaScript Style Guide](https://badgen.net/badge/code%20style/airbnb/ff5a5f?icon=airbnb)](https://github.com/airbnb/javascript)

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
((h,j,k,m)=>(m={number:[0.9039984824241858,-0,NaN,1/0,-1/0],string:["hello world","\x3Cscript>Hello World\x3C/script>"],boolean:[!0,!1],null:null,undefined:void 0,bigint:9007199254740991n,array:h=[,,,,j=new Map([["hello","world"],["mutual",k=new Set(["hello","world"])]])],regexp:/[a-z0-9]+/i,date:new Date("2023-03-16T11:57:24.849Z"),map:j,set:k},h[3]=h,j.set("self",j),k.add(k).add(h),m.self=m,m))()

// Formatted for readability
((h, j, k, m) => (m = {
  number: [0.9039984824241858, -0, NaN, 1 / 0, -1 / 0],
  string: ["hello world", "\x3Cscript>Hello World\x3C/script>"],
  boolean: [!0, !1],
  null: null,
  undefined: void 0,
  bigint: 9007199254740991n,
  array: h = [, , , , j = new Map([
    ["hello", "world"],
    ["mutual", k = new Set(["hello", "world"])]
  ])],
  regexp: /[a-z0-9]+/i,
  date: new Date("2023-03-16T11:57:24.849Z"),
  map: j,
  set: k
}, h[3] = h, j.set("self", j), k.add(k).add(h), m.self = m, m))()
```

### Mutual cyclic example

```js
import { serialize } from 'seroval';

const a = new Map([['name', 'a']]);
const b = new Map([['name', 'b']]);
const c = new Map([['name', 'c']]);
const d = new Map([['name', 'd']]);

c.set('left', a);
d.set('left', a);
c.set('right', b);
d.set('right', b);
a.set('children', [c, d]);
b.set('children', [c, d]);

const result = serialize({ a, b, c, d });
console.log(result);
```

Output (as a string):

```js
((h,j,k,m,o,q)=>(q={a:h=new Map([["name","a"],["children",[j=new Map([["name","c"],["right",o=new Map([["name","b"],["children",k=[,m=new Map([["name","d"]])]]])]]),m]]]),b:o,c:j,d:m},j.set("left",h),k[0]=j,m.set("left",h).set("right",o),q))()

// Formatted
((h, j, k, m, o, q) => (q = {
  a: h = new Map([
    ["name", "a"],
    ["children", [j = new Map([
      ["name", "c"],
      ["right", o = new Map([
        ["name", "b"],
        ["children", k = [, m = new Map([
          ["name", "d"]
        ])]]
      ])]
    ]), m]]
  ]),
  b: o,
  c: j,
  d: m
}, j.set("left", h), k[0] = j, m.set("left", h).set("right", o), q))()
```

## Deserialization

```js
import { serialize, deserialize } from 'seroval';

const value = undefined;
console.log(deserialize(serialize(value)) === value);
```

## JSON

`serialize` and `deserialize` is great for server-to-client communication, but what about the other way? `serialize` may cause an [RCE if used as a payload for requests](https://huntr.dev/bounties/63f1ff91-48f3-4886-a179-103f1ddd8ff8). `seroval` includes `toJSON` and `fromJSON` as an alternative form of serialization.

First example above outputs the following json

```js
import { toJSON } from 'seroval';
// ...
const result = toJSON(object);
console.log(result);
```

```json
{"t":{"t":8,"i":0,"d":{"k":["number","string","boolean","null","undefined","bigint","array","regexp","date","map","set","self"],"v":[{"t":7,"i":1,"a":[{"t":0,"s":0.7047255726239685},{"t":0,"s":"-0"},{"t":0,"s":null},{"t":0,"s":"1/0"},{"t":0,"s":"-1/0"}]},{"t":7,"i":2,"a":[{"t":0,"s":"\"hello world\""},{"t":0,"s":"\"\\x3Cscript>Hello World\\x3C/script>\""}]},{"t":7,"i":3,"a":[{"t":0,"s":"!0"},{"t":0,"s":"!1"}]},{"t":0,"s":null},{"t":0,"s":"void 0"},{"t":1,"s":"9007199254740991n"},{"t":7,"i":4,"a":[null,null,null,{"t":2,"i":4},{"t":6,"i":5,"d":{"k":[{"t":0,"s":"\"hello\""},{"t":0,"s":"\"self\""},{"t":0,"s":"\"mutual\""}],"v":[{"t":0,"s":"\"world\""},{"t":2,"i":5},{"t":5,"i":6,"a":[{"t":0,"s":"\"hello\""},{"t":0,"s":"\"world\""},{"t":2,"i":6},{"t":2,"i":4}]}],"s":3}}]},{"t":4,"i":7,"s":"/[a-z0-9]+/i"},{"t":3,"i":8,"s":"2023-03-16T12:01:29.836Z"},{"t":2,"i":5},{"t":2,"i":6},{"t":2,"i":0}],"s":12}},"r":0,"i":true,"f":8191,"m":[4,5,6,0]}
```

Then you can feed it to `fromJSON`:

```js
import { fromJSON } from 'seroval';

const revived = fromJSON(result);
```

Alternatively, if you want to compile the JSON output to JS (like `deserialize`), you can use `compileJSON`

```js
import { compileJSON, deserialize } from 'seroval';

const code = compileJSON(result);
const revived = deserialize(code);
```

## Promise serialization

`seroval` allows Promise serialization through `serializeAsync` and `toJSONAsync`.

```js
import { serializeAsync } from 'seroval';

const value = Promise.resolve(100);

const result = await serializeAsync(value); // "Promise.resolve(100)"

console.log(await deserialize(result)); // 100
```

> **Note**
> `seroval` can only serialize the resolved value and so the output will always be using `Promise.resolve`. If the Promise fulfills with rejection, the rejected value is thrown before serialization happens.

## Supports

The following values are the only values accepted by `seroval`:

- Exact values
  - `NaN`
  - `Infinity`
  - `-Infinity`
  - `-0`
- Primitives
  - `number`
  - `string`
  - `boolean`
  - `null`
  - `undefined`
  - `bigint`
- `Array` + holes
- `Object`
  - `RegExp`
  - `Date`
  - `Map`
  - `Set`
- `TypedArray`
  - `Int8Array`
  - `Int16Array`
  - `Int32Array`
  - `Uint8Array`
  - `Uint16Array`
  - `Uint32Array`
  - `Uint8ClampedArray`
  - `Float32Array`
  - `Float64Array`
  - `BigInt64Array`
  - `BigUint64Array`
- `Error`
  - `AggregateError`
  - `EvalError`
  - `RangeError`
  - `ReferenceError`
  - `SyntaxError`
  - `TypeError`
  - `URIError`
- `Promise` (with `serializeAsync`)
- [`Iterable`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols#the_iterable_protocol)
- Cyclic references (both self and mutual)

## Compat

`serialize`, `serializeAsync`, `toJSON` and `toJSONAsync` can accept a `{ disabledFeatures: number }` option. The `disabledFeatures` defines how various code output of `serialize`, `serializeAsync` and `compileJSON`.

```js
import { serialize, Feature } from 'seroval';

const y = Object.create(null);
y.self = y;
y.example = 'Hello World';

function serializeWithTarget(value, disabledFeatures) {
  const result = serialize(value, {
    disabledFeatures,
  });
  console.log(result);
}

serializeWithTarget(y, Feature.ArrowFunction | Feature.ObjectAssign);
serializeWithTarget(y, 0);
```

```js
(function(h){return (h=Object.create(null),h.self=h,h.example="Hello World",h)})()
(h=>(h=Object.assign(Object.create(null),{example:"Hello World"}),h.self=h,h))()
```

`disabledFeatures` uses bit flags for faster checking, so if you need to disable multiple features, you can use the logical OR symbol (`|`).

Here's an `ES2017` flag:

```js
import { serialize, Feature } from 'seroval';

const ES2017FLAG = 
  Feature.AggregateError // ES2021
  | Feature.BigInt // ES2020
  | Feature.BigIntTypedArray // ES2020;

serialize(myValue, {
  disabledFeatures: ES2017FLAG,
})
```

By default, all feature flags are enabled. The following are the feature flags and their behavior when disabled:

- [`AggregateError`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AggregateError)
  - Compiles down to `Error` instead.
- [`ArrayPrototypeValues`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/values)
  - Used for iterables, uses `Symbol.iterator` instead (if `SymbolIterator` is not set).
- [`ArrowFunction`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions)
  - Uses function expressions for top-level and for deferred Promise values
  - method shorthands (if `MethodShortand` is not set) or function expressions for iterables.
- [`BigInt`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt)
  - Throws when attempted to use, includes `BigIntTypedArray`
- [`ErrorPrototypeStack`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/stack)
  - Skipped when detected.
- [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map)
  - Throws when attempted to use.
- [`MethodShorthand`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Method_definitions)
  - Uses function expressions instead.
- [`ObjectAssign`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
  - Uses manual object assignments instead.
- [`Promise`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)
  - Throws when attempted to use in `serializeAsync` and `toJSONAsync`.
- [`Set`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set)
  - Throws when attempted to use.
- [`SymbolIterator`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/iterator)
  - Throws when attempted to use.
- [`TypedArray`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray)
  - Throws when attempted to use.
- [`BigIntTypedArray`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt64Array)
  - Throws when attempted to use
  - Also throws if `BigInt` is disabled.

## Sponsors

![Sponsors](https://github.com/lxsmnsyc/sponsors/blob/main/sponsors.svg?raw=true)

## License

MIT © [lxsmnsyc](https://github.com/lxsmnsyc)
