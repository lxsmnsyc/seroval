import { ALL_ENABLED } from '../compat';

export interface CrossParserContextOptions {
  refs?: Map<unknown, number>;
  disabledFeatures?: number;
}

export interface CrossParserContext {
  refs: Map<unknown, number>;
  features: number;
}

export function createCrossParserContext(options: CrossParserContextOptions): CrossParserContext {
  return {
    refs: options.refs || new Map<unknown, number>(),
    features: ALL_ENABLED ^ (options.disabledFeatures || 0),
  };
}

export function createCrossIndexedValue<T>(
  ctx: CrossParserContext,
  current: T,
): number {
  const ref = ctx.refs.get(current);
  if (ref == null) {
    const id = ctx.refs.size;
    ctx.refs.set(current, id);
    return id;
  }
  return ref;
}
