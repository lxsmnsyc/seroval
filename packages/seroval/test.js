
import { serialize, Feature } from 'seroval';

const example = new AggregateError([]);

example.errors = [example];

console.dir(serialize(example, { disabledFeatures: Feature.ErrorPrototypeStack }), {
  depth: null
});