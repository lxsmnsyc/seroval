import { serialize } from './dist/esm/development/index.mjs';

const example = {};

example[NaN] = example

console.log(serialize(example));
