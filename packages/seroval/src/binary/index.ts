import { resolvePlugins } from '../core/plugin';
import {
  createDeserializerContext,
  createReferenceMap,
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
  const plugins = resolvePlugins(options.plugins);
  const context = createSerializerContext({
    ...options,
    plugins,
  });
  startSerialize(context, value);
  return endSerialize.bind(null, context);
}

export type DeserializeOptions = DeserializerContextOptions;

export async function deserialize<T>(
  options: DeserializeOptions,
): Promise<{ value: T }> {
  const plugins = resolvePlugins(options.plugins);
  const context = createDeserializerContext({
    ...options,
    plugins,
    refs: createReferenceMap(),
  });
  return (await deserializeStart(context)) as Promise<{ value: T }>;
}

export type { DeserializerContext } from './deserializer';
export type { SerializerContextOptions } from './serializer';
