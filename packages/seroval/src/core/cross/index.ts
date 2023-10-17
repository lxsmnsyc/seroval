import type { CrossAsyncParserContextOptions } from './async';
import AsyncCrossParserContext from './async';
import type { CrossContextOptions } from './cross-parser';
import CrossSerializerContext from './serialize';
import type { CrossStreamParserContextOptions } from './stream';
import StreamCrossParserContext from './stream';
import type { CrossSyncParserContextOptions } from './sync';
import SyncCrossParserContext from './sync';

export interface CrossSerializeOptions
  extends CrossSyncParserContextOptions, CrossContextOptions {
}

export function crossSerialize<T>(
  source: T,
  options: CrossSerializeOptions = {},
): string {
  const ctx = new SyncCrossParserContext({
    plugins: options.plugins,
    disabledFeatures: options.disabledFeatures,
    refs: options.refs,
  });
  const tree = ctx.parse(source);
  const serial = new CrossSerializerContext({
    plugins: options.plugins,
    features: ctx.features,
    scopeId: options.scopeId,
    markedRefs: ctx.marked,
  });
  return serial.serializeTop(tree);
}

export interface CrossSerializeAsyncOptions
  extends CrossAsyncParserContextOptions, CrossContextOptions {
}

export async function crossSerializeAsync<T>(
  source: T,
  options: CrossSerializeAsyncOptions = {},
): Promise<string> {
  const ctx = new AsyncCrossParserContext({
    plugins: options.plugins,
    disabledFeatures: options.disabledFeatures,
    refs: options.refs,
  });
  const tree = await ctx.parse(source);
  const serial = new CrossSerializerContext({
    plugins: options.plugins,
    features: ctx.features,
    scopeId: options.scopeId,
    markedRefs: ctx.marked,
  });
  return serial.serializeTop(tree);
}

// export interface SerovalCrossJSON {
//   t: SerovalNode;
//   f: number;
// }

// export function toCrossJSON<T>(
//   source: T,
//   options?: CrossParserContextOptions,
// ): SerovalCrossJSON {
//   const ctx = createCrossParserContext(options);
//   return {
//     t: parseSync(ctx, source),
//     f: ctx.features,
//   };
// }

// export async function toCrossJSONAsync<T>(
//   source: T,
//   options?: CrossParserContextOptions,
// ): Promise<SerovalCrossJSON> {
//   const ctx = createCrossParserContext(options);
//   return {
//     t: await parseAsync(ctx, source),
//     f: ctx.features,
//   };
// }

// export function compileCrossJSON(source: SerovalCrossJSON): string {
//   const serial = createCrossSerializerContext({
//     features: source.f,
//   });
//   const result = crossSerializeTree(serial, source.t);
//   return finalize(
//     serial,
//     source.t.i,
//     result,
//   );
// }

// export function fromJSON<T>(source: SerovalJSON): T {
//   const serial = createDeserializerContext({
//     markedRefs: source.m,
//   });
//   return deserializeTree(serial, source.t) as T;
// }

export interface CrossSerializeStreamOptions
  extends Omit<CrossStreamParserContextOptions, 'onParse'>, CrossContextOptions {
  onSerialize: (data: string, initial: boolean) => void;
}

export function crossSerializeStream<T>(
  source: T,
  options: CrossSerializeStreamOptions,
): () => void {
  const ctx = new StreamCrossParserContext({
    refs: options.refs,
    disabledFeatures: options.disabledFeatures,
    onParse(node, initial): void {
      const serial = new CrossSerializerContext({
        plugins: options.plugins,
        features: ctx.features,
        scopeId: options.scopeId,
        markedRefs: ctx.marked,
      });

      let serialized: string;

      try {
        serialized = serial.serializeTop(node);
      } catch (err) {
        if (options.onError) {
          options.onError(err);
        }
        return;
      }

      options.onSerialize(
        serialized,
        initial,
      );
    },
    onError: options.onError,
    onDone: options.onDone,
  });

  ctx.start(source);

  return () => {
    ctx.destroy();
  };
}
