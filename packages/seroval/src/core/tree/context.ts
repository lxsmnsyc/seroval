import type { BaseSerializerContext } from '../context';
import getIdentifier from '../get-identifier';

export interface SerializerReference {
  size: number;
  // Map tree refs to actual refs
  valid: (number | undefined)[];
  // Refs that are...referenced
  marked: Set<number>;
}

export interface SerializerContext extends BaseSerializerContext {
  reference: SerializerReference;
  // Variables
  vars: (string | undefined)[];
}

export interface SerializerOptions {
  markedRefs: number[] | Set<number>;
  features: number;
}

export function createSerializerContext(options: SerializerOptions): SerializerContext {
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
    flags: [],
  };
}

/**
 * Increments the number of references the referenced value has
 */
export function markRef(
  ctx: SerializerContext,
  current: number,
): void {
  ctx.reference.marked.add(current);
}
/**
 * Creates the reference param (identifier) from the given reference ID
 * Calling this function means the value has been referenced somewhere
 */
export function getRefParam(ctx: SerializerContext, index: number): string {
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

export interface DeserializerContext {
  values: Map<number, unknown>;
  refs: Set<number>;
}

export interface DeserializerOptions {
  markedRefs: number[] | Set<number>;
}

export function createDeserializerContext(
  options: DeserializerOptions,
): DeserializerContext {
  return {
    values: new Map(),
    refs: new Set(options.markedRefs),
  };
}
