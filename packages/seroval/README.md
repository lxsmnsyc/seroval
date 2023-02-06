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
import seroval from 'seroval';

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

const result = seroval(object);
```

Output (as a string):

```js
((h,j,k,m)=>(h={number:[0.5906513825027921,-0,NaN,Infinity,-Infinity],string:["hello world","\x3Cscript>Hello World\x3C/script>"],boolean:[!0,!1],null:null,undefined:void 0,bigint:BigInt("9007199254740991"),array:j=[,,,,k=new Map([["hello","world"],["mutual",m=new Set(["hello","world"])]])],regexp:/[a-z0-9]+/i,date:new Date("2023-02-06T06:16:00.384Z"),map:k,set:m},j[3]=j,h.self=h,k.set("self",k),m.add(m).add(j),h))()

// Formatted for readability
((h, j, k, m) => (h = {
  number: [0.5906513825027921, -0, NaN, Infinity, -Infinity],
  string: ["hello world", "\x3Cscript>Hello World\x3C/script>"],
  boolean: [!0, !1],
  null: null,
  undefined: void 0,
  bigint: BigInt("9007199254740991"),
  array: j = [, , , , k = new Map([
    ["hello", "world"],
    ["mutual", m = new Set(["hello", "world"])]
  ])],
  regexp: /[a-z0-9]+/i,
  date: new Date("2023-02-06T06:16:00.384Z"),
  map: k,
  set: m
}, j[3] = j, h.self = h, k.set("self", k), m.add(m).add(j), h))()
```

### Mutual cyclic example

```js
import seroval from 'seroval';

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

const result = seroval({ a, b, c, d });
```

Output (as a string):

```js
((h,j,k,m,o,q)=>(q={a:h=new Map([["name","a"],["children",[j=new Map([["name","c"],["right",k=new Map([["name","b"],["children",o=[,m=new Map([["name","d"]])]]])]]),m]]]),b:k,c:j,d:m},o[0]=j,j.set("left",h),m.set("left",h).set("right",k),q))()

// Formatted
((h, j, k, m, o, q) => (q = {
  a: h = new Map([
    ["name", "a"],
    ["children", [j = new Map([
      ["name", "c"],
      ["right", k = new Map([
        ["name", "b"],
        ["children", o = [, m = new Map([
          ["name", "d"]
        ])]]
      ])]
    ]), m]]
  ]),
  b: k,
  c: j,
  d: m
}, o[0] = j, j.set("left", h), m.set("left", h).set("right", k), q))()
```

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
- Cyclic references (both self and mutual)

## License

MIT © [lxsmnsyc](https://github.com/lxsmnsyc)
