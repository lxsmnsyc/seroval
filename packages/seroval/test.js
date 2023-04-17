
import { serialize, Feature } from './dist/esm/development/index.mjs';

const example = Object.create(null);

example[Symbol.iterator] = function* () {
  yield example;
  yield example;
  yield example;
};

example.self = example;

console.dir(serialize(example, {
  disabledFeatures: Feature.ObjectAssign,
}), {
  depth: null
});
