import type { Assignment, FlaggedObject } from '../assignments';
import { ALL_ENABLED } from '../compat';
import type { BaseParserContext } from '../context';
import type { SerovalNode } from '../types';

export interface CrossParserContextOptions {
  scopeId?: string;
  refs?: Map<unknown, number>;
  disabledFeatures?: number;
}

export interface CrossParserContext {
  scopeId?: string;
  refs: Map<unknown, number>;
  features: number;
}

export function createCrossParserContext(
  options: CrossParserContextOptions = {},
): CrossParserContext {
  return {
    scopeId: options.scopeId,
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

export interface StreamingCrossParserContextOptions extends CrossParserContextOptions {
  onParse: (node: SerovalNode, initial: boolean) => void;
  onDone?: () => void;
}

export interface StreamingCrossParserContext extends CrossParserContext {
  alive: boolean;
  pending: number;
  onParse(node: SerovalNode, initial: boolean): void;
  onDone(): void;
}

export function createStreamingCrossParserContext(
  options: StreamingCrossParserContextOptions,
): StreamingCrossParserContext {
  return {
    alive: true,
    pending: 0,
    refs: options.refs || new Map<unknown, number>(),
    features: ALL_ENABLED ^ (options.disabledFeatures || 0),
    onParse: options.onParse,
    onDone(): void {
      if (options.onDone) {
        options.onDone();
      }
    },
    scopeId: options.scopeId,
  };
}

export function pushPendingState(ctx: StreamingCrossParserContext): void {
  ctx.pending++;
}

export function popPendingState(ctx: StreamingCrossParserContext): void {
  if (--ctx.pending <= 0) {
    ctx.onDone();
  }
}

export interface CrossSerializerContext extends BaseParserContext {
  stack: number[];
  // Array of assignments to be done (used for recursion)
  assignments: Assignment[];
  // Object flags
  flags: FlaggedObject[];
}

export interface CrossSerializerOptions {
  features: number;
}

export function createCrossSerializerContext(
  options: CrossSerializerOptions,
): CrossSerializerContext {
  return {
    stack: [],
    assignments: [],
    features: options.features,
    flags: [],
  };
}
