import { serialize } from 'seroval';


const example = {
  *[Symbol.iterator]() {
    yield 'Hello Iterator';
  },
  message: 'Hello World',
}

example.self = example;

const target = 'es2015';
console.log('Target is', target)
const result = serialize(example, {
  target,
});
// const result = serialize(((h,j)=>(j=Object.assign({[Symbol.iterator]:()=>[h,h,h].values()},{example:h={}}),j))());
console.log(result);
