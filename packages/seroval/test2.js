import { serialize, Feature } from 'seroval';

const y = Object.create(null);
y.self = y;
y.example = 'Hello World';

function serializeWithTarget(value, disabledFeatures) {
  const result = serialize(value, {
    disabledFeatures,
  });
  console.log(result);
}

serializeWithTarget(y, Feature.ArrowFunction | Feature.ObjectAssign);
serializeWithTarget(y, 0);