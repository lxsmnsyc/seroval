/* eslint-disable prefer-object-spread */
/* eslint-disable max-classes-per-file */
import { parseTargets } from './compat';
import getIdentifier from './get-identifier';

interface IndexAssignment {
  type: 'index';
  source: string;
  value: string;
}

interface MapAssignment {
  type: 'map';
  source: string;
  key: string;
  value: string;
}

interface SetAssignment {
  type: 'set';
  source: string;
  value: string;
}

// Array of assignments to be done (used for recursion)
export type Assignment =
  | IndexAssignment
  | MapAssignment
  | SetAssignment;

export interface Options {
  target: string | string[];
}

const DEFAULT_OPTIONS: Options = {
  target: 'es2023',
};

export class ParserContext {
  refs = new Map<unknown, number>();

  markedRefs: Record<number, number> = {};

  features: number;

  constructor(options: Partial<Options> = {}) {
    const result = Object.assign({}, DEFAULT_OPTIONS, options || {});
    this.features = parseTargets(result.target);
  }
}

export interface SerializationOptions {
  markedRefs: Record<number, number>;
  features: number;
}

export class SerializationContext {
  stack: number[] = [];

  // Map tree refs to actual refs
  validRefs: number[] = [];

  refSize = 0;

  // Variables
  vars: string[] = [];

  // Array of assignments to be done (used for recursion)
  assignments: Assignment[] = [];

  // Supported features
  features: number;

  // Refs that are...referenced
  markedRefs: Record<number, number>;

  constructor(options: SerializationOptions) {
    this.features = options.features;
    this.markedRefs = options.markedRefs;
  }
}

/**
 * Increments the number of references the referenced value has
 */
export function markRef(ctx: ParserContext | SerializationContext, current: number) {
  ctx.markedRefs[current] = 1;
}

/**
 * Creates a new reference ID from a given reference ID
 * This new reference ID means that the reference itself
 * has been referenced at least once, and is used to generate
 * the variables
 */
function createValidRef(
  ctx: SerializationContext,
  index: number,
) {
  const current = ctx.validRefs[index];
  if (current == null) {
    const value = ctx.refSize++;
    ctx.validRefs[index] = value;
    return value;
  }
  return current;
}

/**
 * Creates the reference param (identifier) from the given reference ID
 * Calling this function means the value has been referenced somewhere
 */
export function getRefParam(ctx: SerializationContext, index: number) {
  const actualIndex = createValidRef(ctx, index);
  if (ctx.vars[actualIndex]) {
    return ctx.vars[actualIndex];
  }
  const result = getIdentifier(actualIndex);
  ctx.vars[actualIndex] = result;
  return result;
}

/**
 * Creates a reference ID from the given values
 */
export function createRef(
  ctx: ParserContext,
  current: unknown,
  mark: boolean,
): number {
  // Check if reference number already exists
  const ref = ctx.refs.get(current);
  if (ref != null) {
    // Exists, means this value is currently
    // being referenced
    // Mark reference
    if (mark) {
      markRef(ctx, ref);
    }
    return ref;
  }
  // Create a new reference ID
  const id = ctx.refs.size;
  ctx.refs.set(current, id);
  return id;
}
