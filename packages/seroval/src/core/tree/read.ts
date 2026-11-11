import { ALL_ENABLED } from '../compat';
import {
  type BaseDeserializerContextOptions,
  createVanillaDeserializerContext,
  deserializeTop,
} from '../context/deserializer';
import { type PluginAccessOptions, resolvePlugins } from '../plugin';
import type { SerovalNode } from '../types';

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
export interface FromJSONOptions
  extends
    PluginAccessOptions,
    Pick<BaseDeserializerContextOptions, 'depthLimit' | 'maxBase64Length'> {
  /** Feature flags to disable when rebuilding the value. */
  disabledFeatures?: number;
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
  // oxlint-disable-next-line no-eval -- Deserializing runs the serialized source by design.
  return (0, eval)(source) as T;
}

/**
 * Rebuilds a value from a {@link SerovalJSON} tree produced by {@link toJSON} /
 * {@link toJSONAsync}. Unlike {@link deserialize} this constructs the value
 * directly without ever evaluating code, so it is the safe choice for input
 * that crossed an untrusted boundary.
 */
export function fromJSON<T>(source: SerovalJSON, options: FromJSONOptions = {}): T {
  const plugins = resolvePlugins(options.plugins);
  const disabledFeatures = options.disabledFeatures ?? 0;
  // oxlint-disable-next-line no-unnecessary-condition -- Untrusted JSON can omit the features.
  const sourceFeatures = source.f ?? ALL_ENABLED;
  const ctx = createVanillaDeserializerContext({
    depthLimit: options.depthLimit,
    maxBase64Length: options.maxBase64Length,
    plugins,
    markedRefs: source.m,
    features: sourceFeatures & ~disabledFeatures,
    disabledFeatures,
  });
  return deserializeTop(ctx, source.t) as T;
}
