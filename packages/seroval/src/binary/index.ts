/**
 * Binary mode: a compact, streamable wire format that (de)serializes values as
 * `Uint8Array` chunks instead of JavaScript strings or JSON trees. Exposed on
 * the package as the `binary` namespace ({@link serialize}, {@link deserialize}).
 *
 * @module
 */
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

/**
 * Serializes a value into the binary format, emitting `Uint8Array` chunks
 * through `onSerialize` as they are produced and calling `onDone` once every
 * value - including async ones like `Promise` and `ReadableStream` - has
 * settled. The binary format is a compact, streamable alternative to the string
 * output of the tree API and is decoded with {@link deserialize}.
 *
 * @returns A function that aborts serialization and releases its resources.
 */
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

/**
 * Decodes a binary payload produced by {@link serialize}, pulling chunks from
 * `read` (which resolves to `undefined` at end of stream) and building the
 * value without ever evaluating code. The returned promise resolves as soon as
 * the root value is available - which, for a streamed value, can be before its
 * nested Promises and streams have finished settling.
 *
 * @returns A promise for `{ value }`, the decoded value.
 */
export async function deserialize<T>(
  options: DeserializeOptions,
): Promise<{ value: T }> {
  const plugins = resolvePlugins(options.plugins);
  const context = createDeserializerContext({
    ...options,
    plugins,
  });
  return (await deserializeStart(context)) as Promise<{ value: T }>;
}

export { createReferenceMap };

export type { DeserializerContext } from './deserializer';
export type { SerializerContextOptions } from './serializer';
