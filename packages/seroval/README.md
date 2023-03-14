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
```

Output (as a string):

```js
((h,j,k,m)=>(m={number:[0.5623457676854244,-0,NaN,1/0,-1/0],string:["hello world","\x3Cscript>Hello World\x3C/script>"],boolean:[!0,!1],null:null,undefined:void 0,bigint:9007199254740991n,array:h=[,,,,j=new Map([["hello","world"],["mutual",k=new Set(["hello","world"])]])],regexp:/[a-z0-9]+/i,date:new Date("2023-03-14T11:16:24.879Z"),map:j,set:k},h[3]=h,j.set("self",j),k.add(k).add(h),m.self=m,m))()

// Formatted for readability
((h, j, k, m) => (m = {
  number: [0.5623457676854244, -0, NaN, 1 / 0, -1 / 0],
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
  date: new Date("2023-03-14T11:16:24.879Z"),
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

## Promise serialization

`seroval` allows Promise serialization through `serializeAsync`.

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

`serialize` and `serializeAsync` can accept a `{ target: string | string[] }` options. The `target` property decides what the serialization output would look like. The default target is `es2023`.

```js
import { serialize } from 'seroval';

const y = Object.create(null);
y.self = y;

function serializeWithTarget(value, target) {
  console.log('Target is', target)
  const result = serialize(value, {
    target,
  });
  console.log(result);
}

serializeWithTarget(y, 'es5');
serializeWithTarget(y, 'es2023');
```

Output

```
Target is es5
(function(h){return (h=Object.create(null),h.self=h,h)})()
Target is es2023
(h=>(h=Object.create(null),h.self=h,h))()
```

You can also combine targets:

```js
serialize(value, {
  targets: ['chrome85', 'edge85'],
});
```

Supported runtimes:

- `es`
  - Valid values are `es5`, `es6` and above (e.g. `es2020`).
- Desktop
  - `chrome`
  - `edge`
  - `safari`
  - `firefox`
  - `opera`
- Mobile
  - `ios`
  - `samsung`
- Runtimes
  - `deno`
  - `node`

> **Note**
> Version for runtimes excluding `es` can use semver format (`major.minor.patch`) e.g. `chrome110`, `node0.12`

Feature flags and compat attempt:

- `AggregateError`
  - Compiles down to `Error` instead.
- `Array.prototype.values`
  - Used for iterables, uses `Symbol.iterator` instead.
- Arrow functions
  - Uses function expressions for top-level, and either method shorthands or function expressions for iterables.
- `BigInt`
  - Throws when attempted to use, includes `BigInt64Array` and `BigUint64Array`
- `Map`
  - Throws when attempted to use.
- Method shorthands
  - Uses function expressions instead.
- `Object.assign`
  - Uses manual object assignments instead.
- `Promise`
  - Throws when attempted to use, specially in `serializeAsync`.
- `Set`
  - Throws when attempted to use.
- `Symbol.iterator`
  - Throws when attempted to use.
- `TypedArray`
  - Throws when attempted to use.

## Sponsors

![Sponsors](https://github.com/lxsmnsyc/sponsors/blob/main/sponsors.svg?raw=true)

## License

MIT © [lxsmnsyc](https://github.com/lxsmnsyc)
