
import { serialize, Feature } from './dist/esm/development/index.mjs';

const example = Object.create(null);

example.a = {
  b: {},
};
example.a.b.parent = example.a;

console.dir(serialize(example, {
  disabledFeatures: Feature.ObjectAssign,
}), {
  depth: null
});
