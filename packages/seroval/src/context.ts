import { ALL_ENABLED } from './compat';
import getIdentifier from './get-identifier';
import { AsyncServerValue } from './types';

interface IndexAssignment {
  t: 'index';
  s: string;
  k: undefined;
  v: string;
}

interface MapAssignment {
  t: 'map';
  s: string;
  k: string;
  v: string;
}

interface SetAssignment {
  t: 'set';
  s: string;
  k: undefined;
  v: string;
}

// Array of assignments to be done (used for recursion)
export type Assignment =
  | IndexAssignment
  | MapAssignment
  | SetAssignment;

export interface ParserContext {
  refs: Map<unknown, number>;
  markedRefs: Set<number>;
  features: number;
}

export interface SerializationContext {
  stack: number[];
  // Map tree refs to actual refs
  validRefs: number[];
  refSize: number;
  // Refs that are...referenced
  markedRefs: Set<number>;
  // Variables
  vars: string[];
  // Array of assignments to be done (used for recursion)
  assignments: Assignment[];
  // Supported features
  features: number;

  valueMap: Map<number, AsyncServerValue>;
}

export interface Options {
  disabledFeatures: number;
}

const DEFAULT_OPTIONS: Options = {
  disabledFeatures: 0,
};

export function createParserContext(options: Partial<Options> = {}): ParserContext {
  // eslint-disable-next-line prefer-object-spread
  const result = Object.assign({}, DEFAULT_OPTIONS, options || {});
  return {
    markedRefs: new Set(),
    refs: new Map(),
    features: ALL_ENABLED ^ result.disabledFeatures,
  };
}

export interface SerializationOptions {
  markedRefs: number[] | Set<number>;
  features: number;
}

export function createSerializationContext(options: SerializationOptions): SerializationContext {
  return {
    stack: [],
    vars: [],
    assignments: [],
    validRefs: [],
    refSize: 0,
    features: options.features,
    markedRefs: new Set(options.markedRefs),
    valueMap: new Map(),
  };
}

/**
 * Increments the number of references the referenced value has
 */
export function markRef(ctx: ParserContext | SerializationContext, current: number) {
  ctx.markedRefs.add(current);
}
/**
 * Creates the reference param (identifier) from the given reference ID
 * Calling this function means the value has been referenced somewhere
 */
export function getRefParam(ctx: SerializationContext, index: number) {
  /**
   * Creates a new reference ID from a given reference ID
   * This new reference ID means that the reference itself
   * has been referenced at least once, and is used to generate
   * the variables
   */
  let actualIndex = ctx.validRefs[index];
  if (actualIndex == null) {
    actualIndex = ctx.refSize++;
    ctx.validRefs[index] = actualIndex;
  }
  let identifier = ctx.vars[actualIndex];
  if (identifier == null) {
    identifier = getIdentifier(actualIndex);
    ctx.vars[actualIndex] = identifier;
  }
  return identifier;
}

export function getRootID(
  ctx: ParserContext,
  current: AsyncServerValue,
) {
  const ref = ctx.refs.get(current);
  if (ref == null) {
    return ctx.refs.size;
  }
  return ref;
}

export function createRef(
  ctx: ParserContext,
  current: AsyncServerValue,
) {
  const ref = ctx.refs.get(current);
  if (ref == null) {
    const id = ctx.refs.size;
    ctx.refs.set(current, id);
    return id;
  }
  markRef(ctx, ref);
  return ref;
}
