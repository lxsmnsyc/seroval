import {
  createAsyncParserContext,
  parseTopAsync,
} from '../context/async-parser';
import {
  createVanillaDeserializerContext,
  deserializeTop,
} from '../context/deserializer';
import type { BaseParserContextOptions } from '../context/parser';
import {
  createVanillaSerializerContext,
  serializeTopVanilla,
} from '../context/serializer';
import { createSyncParserContext, parseTop } from '../context/sync-parser';
import {
  type PluginAccessOptions,
  resolvePlugins,
  SerovalMode,
} from '../plugin';
import type { SerovalNode } from '../types';
import { ALL_ENABLED } from '../compat';
/** Options accepted by the synchronous parsers ({@link serialize}, {@link toJSON}). */
export type SyncParserContextOptions = Omit<BaseParserContextOptions, 'refs'>;
/** Options accepted by the asynchronous parsers ({@link serializeAsync}, {@link toJSONAsync}). */
export type AsyncParserContextOptions = Omit<BaseParserContextOptions, 'refs'>;

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
export function serialize<T>(
  source: T,
  options: SyncParserContextOptions = {},
): string {
  const plugins = resolvePlugins(options.plugins);
  const ctx = createSyncParserContext(SerovalMode.Vanilla, {
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
  options: AsyncParserContextOptions = {},
): Promise<string> {
  const plugins = resolvePlugins(options.plugins);
  const ctx = createAsyncParserContext(SerovalMode.Vanilla, {
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
 * Evaluates a string produced by {@link serialize} / {@link serializeAsync}
 * back into a value.
 *
 * The input is run as JavaScript through `eval`, so only pass strings this
 * library produced from data you trust. For untrusted transport use the
 * JSON-tree pipeline ({@link toJSON} / {@link fromJSON}), which never evaluates
 * code.
 *
 * @param source A JavaScript expression string.
 */
export function deserialize<T>(source: string): T {
  return (0, eval)(source) as T;
}

/** The plain, JSON-serializable representation produced by {@link toJSON}. */
export interface SerovalJSON {
  /** The root node of the serialized tree. */
  t: SerovalNode;
  /** Bitmask of the runtime features enabled when the tree was produced. */
  f: number;
  /** Ids of the references that were deduplicated (marked) in the tree. */
  m: number[];
}

/** Options for {@link fromJSON}. */
export interface FromJSONOptions extends PluginAccessOptions {
  /** Feature flags to disable when rebuilding the value. */
  disabledFeatures?: number;
}

/**
 * Serializes a value into a plain, JSON-serializable tree ({@link SerovalJSON})
 * rather than a JavaScript string. Send the tree with `JSON.stringify`, then
 * rebuild the value with {@link fromJSON} - a pipeline that never evaluates
 * code and is therefore safe across an untrusted boundary.
 *
 * Synchronous: use {@link toJSONAsync} for values containing Promises.
 */
export function toJSON<T>(
  source: T,
  options: SyncParserContextOptions = {},
): SerovalJSON {
  const plugins = resolvePlugins(options.plugins);
  const ctx = createSyncParserContext(SerovalMode.Vanilla, {
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
  options: AsyncParserContextOptions = {},
): Promise<SerovalJSON> {
  const plugins = resolvePlugins(options.plugins);
  const ctx = createAsyncParserContext(SerovalMode.Vanilla, {
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
export function compileJSON(
  source: SerovalJSON,
  options: PluginAccessOptions = {},
): string {
  const plugins = resolvePlugins(options.plugins);
  const ctx = createVanillaSerializerContext({
    plugins,
    features: source.f,
    markedRefs: source.m,
  });
  return serializeTopVanilla(ctx, source.t);
}

/**
 * Rebuilds a value from a {@link SerovalJSON} tree produced by {@link toJSON} /
 * {@link toJSONAsync}. Unlike {@link deserialize} this constructs the value
 * directly without ever evaluating code, so it is the safe choice for input
 * that crossed an untrusted boundary.
 */
export function fromJSON<T>(
  source: SerovalJSON,
  options: FromJSONOptions = {},
): T {
  const plugins = resolvePlugins(options.plugins);
  const disabledFeatures = options.disabledFeatures || 0;
  const sourceFeatures = source.f ?? ALL_ENABLED;
  const ctx = createVanillaDeserializerContext({
    plugins,
    markedRefs: source.m,
    features: sourceFeatures & ~disabledFeatures,
    disabledFeatures,
  });
  return deserializeTop(ctx, source.t) as T;
}
