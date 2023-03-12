import { serialize } from 'seroval';

const test = {};

const a = {
  *[Symbol.iterator]() {
    yield test;
  },
};
const b = {
  *[Symbol.iterator]() {
    yield a;
    yield test;
  },
};
const result = serialize(b);
// Output:
((h,j)=>(j = Object.assign({
  [Symbol.iterator]: ()=>[h, h, h].values()
}, {
  example: h = {}
}),
j))()
// const result = serialize(((h,j)=>(j=Object.assign({[Symbol.iterator]:()=>[h,h,h].values()},{example:h={}}),j))());
console.log(result);
