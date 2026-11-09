import { createAsyncParserContext, parseTopAsync } from '../context/async-parser';
import type { BaseParserContextOptions } from '../context/parser';
import { createVanillaSerializerContext, serializeTopVanilla } from '../context/serializer';
import { createSyncParserContext, parseTop } from '../context/sync-parser';
import { type PluginAccessOptions, resolvePlugins } from '../plugin';
import type { SerovalJSON } from './read';

/**
 * Options for `serialize`. The same as the parser options, without `refs`:
 * the output is self-contained, so there is nothing to share between calls.
 */
export type SerializeOptions = Omit<BaseParserContextOptions, 'refs'>;
/** Options for `serializeAsync`. */
export type SerializeAsyncOptions = Omit<BaseParserContextOptions, 'refs'>;
/** Options for `toJSON`. */
export type ToJSONOptions = SerializeOptions;
/** Options for `toJSONAsync`. */
export type ToJSONAsyncOptions = SerializeAsyncOptions;

/**
 * Serializes a JavaScript value into a self-contained JavaScript expression
 * string. Turn it back into a value with {@link deserialize} (or by evaluating
 * it in a `<script>`). Preserves cyclic and repeated references and supports
 * many built-in types (`Date`, `RegExp`, `Map`, `Set`, typed arrays, `Error`,
 * boxed primitives, and more).
 *
 * This is the synchronous variant: asynchronous values such as `Promise` or
 * `ReadableStream` are not supported - use {@link serializeAsync} for those.
 *
 * @param source The value to serialize.
 * @param options Plugins and disabled feature flags.
 * @returns A JavaScript expression string.
 */
export function serialize<T>(source: T, options: SerializeOptions = {}): string {
  const plugins = resolvePlugins(options.plugins);
  const ctx = createSyncParserContext({
    compactArrayBufferViews: options.compactArrayBufferViews,
    depthLimit: options.depthLimit,
    plugins,
    disabledFeatures: options.disabledFeatures,
  });
  const tree = parseTop(ctx, source);
  const serial = createVanillaSerializerContext({
    plugins,
    features: ctx.base.features,
    markedRefs: ctx.base.marked,
  });
  return serializeTopVanilla(serial, tree);
}

/**
 * Asynchronous variant of {@link serialize}. Awaits every `Promise` and drains
 * every `ReadableStream` / async iterable reachable from `source`, inlining the
 * resolved values, before producing the final JavaScript expression string.
 *
 * @param source The value to serialize.
 * @param options Plugins and disabled feature flags.
 * @returns A promise for a JavaScript expression string.
 */
export async function serializeAsync<T>(
  source: T,
  options: SerializeAsyncOptions = {},
): Promise<string> {
  const plugins = resolvePlugins(options.plugins);
  const ctx = createAsyncParserContext({
    compactArrayBufferViews: options.compactArrayBufferViews,
    depthLimit: options.depthLimit,
    plugins,
    disabledFeatures: options.disabledFeatures,
  });
  const tree = await parseTopAsync(ctx, source);
  const serial = createVanillaSerializerContext({
    plugins,
    features: ctx.base.features,
    markedRefs: ctx.base.marked,
  });
  return serializeTopVanilla(serial, tree);
}

/**
 * Serializes a value into a plain, JSON-serializable tree ({@link SerovalJSON})
 * rather than a JavaScript string. Send the tree with `JSON.stringify`, then
 * rebuild the value with {@link fromJSON} - a pipeline that never evaluates
 * code and is therefore safe across an untrusted boundary.
 *
 * Synchronous: use {@link toJSONAsync} for values containing Promises.
 */
export function toJSON<T>(source: T, options: ToJSONOptions = {}): SerovalJSON {
  const plugins = resolvePlugins(options.plugins);
  const ctx = createSyncParserContext({
    compactArrayBufferViews: options.compactArrayBufferViews,
    depthLimit: options.depthLimit,
    plugins,
    disabledFeatures: options.disabledFeatures,
  });
  return {
    t: parseTop(ctx, source),
    f: ctx.base.features,
    m: Array.from(ctx.base.marked),
  };
}

/**
 * Asynchronous variant of {@link toJSON}. Awaits every reachable `Promise`
 * before producing the {@link SerovalJSON} tree.
 */
export async function toJSONAsync<T>(
  source: T,
  options: ToJSONAsyncOptions = {},
): Promise<SerovalJSON> {
  const plugins = resolvePlugins(options.plugins);
  const ctx = createAsyncParserContext({
    compactArrayBufferViews: options.compactArrayBufferViews,
    depthLimit: options.depthLimit,
    plugins,
    disabledFeatures: options.disabledFeatures,
  });
  return {
    t: await parseTopAsync(ctx, source),
    f: ctx.base.features,
    m: Array.from(ctx.base.marked),
  };
}

/**
 * Compiles a {@link SerovalJSON} tree into a JavaScript expression string - the
 * same output {@link serialize} produces - which can then be evaluated with
 * {@link deserialize}.
 *
 * The compiler assumes the tree was produced by this library's parser: it
 * interpolates the tree's already-escaped string fields verbatim and does not
 * re-escape them. Only pass trees you produced yourself, never an untrusted
 * tree - for that, rebuild the value with {@link fromJSON} instead.
 */
export function compileJSON(source: SerovalJSON, options: PluginAccessOptions = {}): string {
  const plugins = resolvePlugins(options.plugins);
  const ctx = createVanillaSerializerContext({
    plugins,
    features: source.f,
    markedRefs: source.m,
  });
  return serializeTopVanilla(ctx, source.t);
}
