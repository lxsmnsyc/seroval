import { serialize } from 'seroval';

const test = {};

const example = {
  example: test,
  *[Symbol.iterator]() {
    yield test;
    yield test;
    yield test;
  },
}
const result = serialize(example);
// Output:
((h,j)=>(j = Object.assign({
  [Symbol.iterator]: ()=>[h, h, h].values()
}, {
  example: h = {}
}),
j))()
// const result = serialize(((h,j)=>(j=Object.assign({[Symbol.iterator]:()=>[h,h,h].values()},{example:h={}}),j))());
console.log(result);
