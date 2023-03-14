import { serialize } from 'seroval';

const a = Object.create(null);
const b = Object.create(null);

a.alt = b;
b.alt = a;

const y = { x: { a, b } };

function serializeWithTarget(value, target) {
  console.log('Target is', target)
  const result = serialize(value, {
    target,
  });
  console.log(result);
}

serializeWithTarget(y, 'es5');
serializeWithTarget(y, 'es2023');
// Target is es5
// (function(h){return (h=Object.create(null),h.self=h,h.example="Hello World",h)})()
// Target is es2023
// (h=>(h=Object.assign(Object.create(null),{example:"Hello World"}),h.self=h,h))()
