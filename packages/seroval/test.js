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

