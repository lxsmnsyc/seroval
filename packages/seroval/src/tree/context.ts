import { ALL_ENABLED } from '../compat';
import type { SerovalObjectFlags } from '../constants';
import getIdentifier from '../get-identifier';

interface IndexAssignment {
  t: 'index';
  s: string;
  k: undefined;
  v: string;
}

interface SetAssignment {
  t: 'set';
  s: string;
  k: string;
  v: string;
}

interface AddAssignment {
  t: 'add';
  s: string;
  k: undefined;
  v: string;
}

interface AppendAssignment {
  t: 'append';
  s: string;
  k: string;
  v: string;
}

// Array of assignments to be done (used for recursion)
export type Assignment =
  | IndexAssignment
  | AddAssignment
  | SetAssignment
  | AppendAssignment;

export interface ParserContext {
  refs: Map<unknown, number>;
  markedRefs: Set<number>;
  features: number;
}

export interface FlaggedObject {
  type: SerovalObjectFlags;
  value: string;
}

export interface SerializationContext {
  stack: number[];
  // Map tree refs to actual refs
  validRefs: (number | undefined)[];
  refSize: number;
  // Refs that are...referenced
  markedRefs: Set<number>;
  // Variables
  vars: (string | undefined)[];
  // Array of assignments to be done (used for recursion)
  assignments: Assignment[];
  // Supported features
  features: number;

  valueMap: Map<number, unknown>;

  // Object flags
  flags: FlaggedObject[];
}

export interface Options {
  disabledFeatures: number;
}

export function createParserContext(options: Partial<Options> = {}): ParserContext {
  return {
    markedRefs: new Set(),
    refs: new Map(),
    features: ALL_ENABLED ^ (options.disabledFeatures || 0),
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
    flags: [],
  };
}

/**
 * Increments the number of references the referenced value has
 */
export function markRef(
  ctx: ParserContext | SerializationContext,
  current: number,
): void {
  ctx.markedRefs.add(current);
}
/**
 * Creates the reference param (identifier) from the given reference ID
 * Calling this function means the value has been referenced somewhere
 */
export function getRefParam(ctx: SerializationContext, index: number): string {
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

export function getRootID<T>(
  ctx: ParserContext,
  current: T,
): number {
  const ref = ctx.refs.get(current);
  if (ref == null) {
    return ctx.refs.size;
  }
  return ref;
}

export function createIndexedValue<T>(
  ctx: ParserContext,
  current: T,
): number {
  const ref = ctx.refs.get(current);
  if (ref == null) {
    const id = ctx.refs.size;
    ctx.refs.set(current, id);
    return id;
  }
  markRef(ctx, ref);
  return ref;
}
