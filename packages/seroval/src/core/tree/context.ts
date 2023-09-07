import { ALL_ENABLED } from '../compat';
import type { SerovalObjectFlags } from '../constants';
import type { BaseParserContext } from '../context';
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

export interface ParserReference {
  ids: Map<unknown, number>;
  marked: Set<number>;
}

export interface ParserContext {
  reference: ParserReference;
  features: number;
}

export interface FlaggedObject {
  type: SerovalObjectFlags;
  value: string;
}

export interface SerializationReference {
  size: number;
  // Map tree refs to actual refs
  valid: (number | undefined)[];
  // Refs that are...referenced
  marked: Set<number>;
}

export interface SerializationContext extends BaseParserContext {
  reference: SerializationReference;

  stack: number[];
  // Variables
  vars: (string | undefined)[];
  // Array of assignments to be done (used for recursion)
  assignments: Assignment[];

  valueMap: Map<number, unknown>;

  // Object flags
  flags: FlaggedObject[];
}

export interface Options {
  disabledFeatures: number;
}

export function createParserContext(options: Partial<Options> = {}): ParserContext {
  return {
    reference: {
      ids: new Map(),
      marked: new Set(),
    },
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
    reference: {
      valid: [],
      size: 0,
      marked: new Set(options.markedRefs),
    },
    features: options.features,
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
  ctx.reference.marked.add(current);
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
  let actualIndex = ctx.reference.valid[index];
  if (actualIndex == null) {
    actualIndex = ctx.reference.size++;
    ctx.reference.valid[index] = actualIndex;
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
  const ref = ctx.reference.ids.get(current);
  if (ref == null) {
    return ctx.reference.ids.size;
  }
  return ref;
}

export function createIndexedValue<T>(
  ctx: ParserContext,
  current: T,
): number {
  const ref = ctx.reference.ids.get(current);
  if (ref == null) {
    const id = ctx.reference.ids.size;
    ctx.reference.ids.set(current, id);
    return id;
  }
  markRef(ctx, ref);
  return ref;
}
