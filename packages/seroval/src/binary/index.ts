import {
  createDeserializerContext,
  type DeserializerContextOptions,
  deserializeStart,
} from './deserializer';
import {
  createSerializerContext,
  endSerialize,
  type SerializerContextOptions,
  startSerialize,
} from './serializer';

export type SerializeOptions = SerializerContextOptions;

export function serialize(value: unknown, options: SerializeOptions) {
  const context = createSerializerContext(options);
  startSerialize(context, value);
  return () => endSerialize(context);
}

export type DeserializeOptions = DeserializerContextOptions;

export async function deserialize<T>(
  options: DeserializeOptions,
): Promise<{ value: T }> {
  const context = createDeserializerContext(options);
  return (await deserializeStart(context)) as Promise<{ value: T }>;
}
