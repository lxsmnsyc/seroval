
import { serialize, Feature } from './dist/esm/development/index.mjs';

const example = Object(Symbol.iterator);

console.dir(serialize(example, {
  disabledFeatures: Feature.ObjectAssign,
}), {
  depth: null
});
