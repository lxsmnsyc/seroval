import { ALL_ENABLED } from '../compat';
import {
  type BaseDeserializerContextOptions,
  createVanillaDeserializerContext,
  deserializeTop,
} from '../context/deserializer';
import { type PluginAccessOptions, resolvePlugins } from '../plugin';
import type { SerovalNode } from '../types';

export interface SerovalJSON {
  t: SerovalNode;
  f: number;
  m: number[];
}

export interface FromJSONOptions
  extends
    PluginAccessOptions,
    Pick<BaseDeserializerContextOptions, 'depthLimit' | 'maxBase64Length'> {
  disabledFeatures?: number;
}

export function deserialize<T>(source: string): T {
  // oxlint-disable-next-line no-eval -- Deserializing runs the serialized source by design.
  return (0, eval)(source) as T;
}

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
