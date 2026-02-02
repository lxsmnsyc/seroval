import {
  createSerializerContext,
  endSerialize,
  type SerializerContextOptions,
  startSerialize,
} from './parser';

export type SerializeOptions = SerializerContextOptions;

export function serialize(value: unknown, options: SerializeOptions) {
  const context = createSerializerContext(options);
  startSerialize(context, value);
  return () => endSerialize(context);
}
