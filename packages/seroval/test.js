import { serialize } from 'seroval';

function* example() {
  yield 1;
  yield 2;
  yield 3;
}
const result = serialize(example());
// const result = serialize(((h,j)=>(j=Object.assign({[Symbol.iterator]:()=>[h,h,h].values()},{example:h={}}),j))());
console.log(result);
