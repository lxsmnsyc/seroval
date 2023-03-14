import { serialize } from 'seroval';

const y = Object.create(null);
y.self = y;
y.example = 'Hello World';

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
