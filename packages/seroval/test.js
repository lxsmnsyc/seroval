
import { serialize, Feature } from 'seroval';

const errors = [];
const example = Object.assign(new AggregateError(errors), {
  errors,
});
errors[0] = example;
console.log(errors)

console.dir(serialize(example, { disabledFeatures: Feature.ErrorPrototypeStack }), {
  depth: null
});

console.log(((h,j)=>(h=Object.assign(new AggregateError([],""),{name:"AggregateError",errors:j=[,]}),j[0]=h,h))());