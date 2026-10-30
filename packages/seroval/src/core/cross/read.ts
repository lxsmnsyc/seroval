import type {
  CrossDeserializerContext,
  CrossDeserializerContextOptions,
} from '../context/deserializer';
import {
  abortDeferred,
  createCrossDeserializerContext,
  deserializeTop,
} from '../context/deserializer';
import { SerovalAbortedError } from '../errors';
import { resolvePlugins } from '../plugin';
import type { SerovalNode } from '../types';

export type FromCrossJSONOptions = CrossDeserializerContextOptions;

function createFromCrossJSONContext(options: FromCrossJSONOptions): CrossDeserializerContext {
  return createCrossDeserializerContext({
    maxBase64Length: options.maxBase64Length,
    plugins: resolvePlugins(options.plugins),
    refs: options.refs,
    features: options.features,
    disabledFeatures: options.disabledFeatures,
    depthLimit: options.depthLimit,
  });
}

export function fromCrossJSON<T>(source: SerovalNode, options: FromCrossJSONOptions): T {
  return deserializeTop(createFromCrossJSONContext(options), source) as T;
}

export interface CrossDeserializer {
  /** Deserializes one streamed record. Records share references. */
  deserialize<T>(node: SerovalNode): T;
  /** Deferred values (promises, streams) created but not yet settled. */
  readonly pending: number;
  /** Rejects pending promises and throws into open streams; idempotent. */
  abort(reason: unknown): void;
}

export type CrossDeserializerOptions = FromCrossJSONOptions;

export function createCrossDeserializer(options: CrossDeserializerOptions): CrossDeserializer {
  const ctx = createFromCrossJSONContext(options);
  ctx.base.pending = new Set();
  return {
    deserialize<T>(node: SerovalNode): T {
      if (!ctx.base.pending) {
        throw new SerovalAbortedError();
      }
      return deserializeTop(ctx, node) as T;
    },
    get pending(): number {
      return ctx.base.pending?.size ?? 0;
    },
    abort(reason: unknown): void {
      abortDeferred(ctx, reason);
    },
  };
}
