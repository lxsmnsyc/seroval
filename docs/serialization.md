# Serialization

`seroval` offers 3 modes of serialization: sync, async and streaming.

## Basic serialization

`serialize` offers the basic form of serialization.

```js
import { serialize } from 'seroval';

console.log(serialize({ foo: 'bar' })); // {foo:"bar"}
```

## Async serialization

`serializeAsync` is similar to `serialize` except that it supports asynchronous values, such as `Promise` instances.

```js
import { serializeAsync } from 'seroval';

console.log(await serializeAsync(Promise.resolve({ foo: 'bar'}))); // Promise.resolve({foo:"bar"})
```

## Deduping references

If the serializer functions encounter multiple instances of the same reference, the reference will get deduped.

```js
import { serialize } from 'seroval';

const parent = {};

const a = { parent };
const b = { parent };

const children = [a, b];

console.log(serialize(children)); // (h=>([{parent:h={}},{parent:h}]))()
```

## Cyclic references

`seroval` also supports cyclic references.

```js
import { serialize } from 'seroval';

const cyclic = {};

cyclic.self = cyclic;

console.log(serialize(cyclic)); // (h=>(h={},h.self=h,h))()
```

It also supports references that are mutually cyclic (e.g. they reference each other)

```js
import { serialize } from 'seroval';

const nodeA = {};
const nodeB = {};

nodeA.next = nodeB;
nodeB.prev = nodeA;

console.log(serialize([nodeA, nodeB])); // ((h,j,k)=>(k=[h={next:j={}},j],j.prev=h,k))()
```

It can also detect potential temporal dead zone

```js
import { serialize } from 'seroval';

const root = {};

const nodeA = { parent: root };
const nodeB = { parent: nodeA };

root.child = nodeA;
nodeA.child = nodeB;

console.log(serialize(root)); // ((h,j,k)=>(h={child:j={child:k={}}},j.parent=h,k.parent=j,h))()
```

## Cross-reference serialization

`serialize` and `serializeAsync` can only dedupe references within its own script, but what if you want two or more scripts to share the same references?

`crossSerialize` and `crossSerializeAsync` provides the capability

```js
import { crossSerialize } from 'seroval';

const nodeA = {};
const nodeB = {};

nodeA.next = nodeB;
nodeB.prev = nodeA;

// keeps track of the shared references
const refs = new Map();
console.log(crossSerialize(nodeA, { refs })); // ($R[0]={next:$R[1]={}},$R[1].prev=$R[0],$R[0])
console.log(crossSerialize(nodeB, { refs })); // $R[1]
```

Take note that cross-reference scripts relies on the global array variable `$R`, which you can declare either manually, or a script via `getLocalHeaderScript`

```js
import { getCrossReferenceHeader } from 'seroval';

console.log(getCrossReferenceHeader()) // self.$R=self.$R||[]
```

## Re-isolating cross-reference

`crossSerialize` and `crossSerializeAsync` can accept a `scopeId` string which allows `$R` to be scoped based on the given `scopeId`.

```js
import { crossSerialize } from 'seroval';

const nodeA = {};
const nodeB = {};

nodeA.next = nodeB;
nodeB.prev = nodeA;

// keeps track of the shared references
const refsA = new Map();
const refsB = new Map();
console.log(crossSerialize(nodeA, { refs: refsA, scopeId: 'A' })); // ($R=>$R[0]={next:$R[1]={}},$R[1].prev=$R[0],$R[0])($R["A"])
console.log(crossSerialize(nodeA, { refs: refsB, scopeId: 'B' })); // ($R=>$R[0]={next:$R[1]={}},$R[1].prev=$R[0],$R[0])($R["B"])
console.log(crossSerialize(nodeB, { refs: refsA, scopeId: 'A' })); // ($R=>$R[1])($R["A"])
console.log(crossSerialize(nodeB, { refs: refsB, scopeId: 'B' })); // ($R=>$R[1])($R["B"])
```

You can independently initialize the `$R` variable by doing

```js
import { getCrossReferenceHeader } from 'seroval';

console.log(getCrossReferenceHeader('A')) // (self.$R=self.$R||{})["A"]=[]
console.log(getCrossReferenceHeader('B')) // (self.$R=self.$R||{})["B"]=[]
```

## Streaming serialization

`serialize` doesn't support async values, but `serializeAsync` do. However, both methods are "blocking" in a sense that you need to wait the entire value to resolve before you can receive the serialized string.

With streaming serialization, you can receive the serialized string immediately for the synchronous part, while receiving the asynchronous part later on.

Streaming serialization relies on cross-referencing since you can think of it as multiple `crossSerialize` calls.

```js
import { crossSerializeStream } from 'seroval';

crossSerializeStream(Promise.resolve({ foo: 'bar'}), {
  onSerialize(data) {
    console.log(data);
  },
});

// Logs:
$R[0]=($R[1]=(s,f,p)=>((p=new Promise((a,b)=>{s=a,f=b})).s=s,p.f=f,p))()
($R[3]=(p,d)=>{p.s(d),p.status="success",p.value=d;delete p.s;delete p.f})($R[0],$R[2]={foo:"bar"})
```

> **INFO**
> Much like other cross-reference methods, you can pass a `refs` and `scopeId` option.

### `createStream`

Streaming serialization allows pushing values through `Promise` instances. However, `Promise` instances only resolve to a single value, but what if you can resolve multiple values at different times?

`ReadableStream` is capable of doing so, however it's not a JS standard (`seroval` supports it through plugins). `Observable` could have been nice however [it's not a JS standard yet](https://github.com/tc39/proposal-observable)

With two of the optinos not available, `seroval` provides a streaming primitive called `createStream` which is capable of buffering streaming data as well as emitting pushed data.

```js
import { createStream } from 'seroval';

const stream = createStream();

// Push early
stream.next('foo');
stream.next('bar');

// Add a listener
stream.on({
  next(data) {
    console.log('NEXT', data);
  },
  throw(data) {
    console.log('THROW', data);
  },
  return(data) {
    console.log('RETURN', data);
  },
});
// Immediately logs `NEXT foo` and `NEXT bar`

stream.return('baz'); // RETURN baz
```

`createStream` instances are also serializable for async serialization

```js
console.log(await serializeAsync(stream));

// which logs
((h,j)=>((j=((b,a,s,l,p,f,e,n)=>(b=[],a=!0,s=!1,l=[],s=0,f=(v,m,x)=>{for(x=0;x<s;x++)l[x]&&l[x][m](v)},n=(o,x,z,c)=>{for(x=0,z=b.length;x<z;x++)(c=b[x],x===z-1?o[s?"return":"throw"](c):o.next(c))},e=(o,t)=>(a&&(l[t=p++]=o),n(o),()=>{a&&(l[t]=void 0)}),{__SEROVAL_STREAM__:!0,on:o=>e(o),next:v=>{a&&(b.push(v),f(v,"next"))},throw:v=>{a&&(b.push(v),f(v,"throw"),a=s=!1,l.length=0)},return:v=>{a&&(b.push(v),f(v,"return"),a=!1,s=!0,l.length=0)}}))(),j.next("foo"),j.next("bar"),j.return("baz"),j)))()
```

Streaming serialization is also supported

```js
crossSerializeStream(stream, {
  onSerialize(data) {
    console.log(data);
  },
});

// which logs
$R[0]=($R[1]=(b,a,s,l,p,f,e,n)=>(b=[],a=!0,s=!1,l=[],s=0,f=(v,m,x)=>{for(x=0;x<s;x++)l[x]&&l[x][m](v)},n=(o,x,z,c)=>{for(x=0,z=b.length;x<z;x++)(c=b[x],x===z-1?o[s?"return":"throw"](c):o.next(c))},e=(o,t)=>(a&&(l[t=p++]=o),n(o),()=>{a&&(l[t]=void 0)}),{__SEROVAL_STREAM__:!0,on:o=>e(o),next:v=>{a&&(b.push(v),f(v,"next"))},throw:v=>{a&&(b.push(v),f(v,"throw"),a=s=!1,l.length=0)},return:v=>{a&&(b.push(v),f(v,"return"),a=!1,s=!0,l.length=0)}}))()
$R[0].next("foo")
$R[0].next("bar")
$R[0].return("baz")
```

## JSON serialization

The mentioned serialization metohds are ideal for server-to-client communication, however, client-to-server communication requires a sanitized data, because the medium is prone to [RCE](https://huntr.dev/bounties/63f1ff91-48f3-4886-a179-103f1ddd8ff8). `seroval` offers JSON modes as an alternative.

| modes | JS | JSON |
| --- | --- | --- |
| sync | `serialize` | `toJSON` |
| async | `serializeAsync` | `toJSONAsync` |
| cross-sync | `crossSerialize` | `toCrossJSON` |
| cross-async | `crossSerializeAsync` | `toCrossJSONAsync` |
| streaming | `crossSerializeStream` | `toCrossJSONStream` |
| deserialization | `deserialize` | `fromJSON` |
| cross-deserialization | `deserialize` | `fromCrossJSON` |

## Push-based streaming serialization

> **INFO**
> Coming soon.
