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

export interface ParserContext {
  refs: Map<unknown, number>;
  markedRefs: Record<number, number>;
  features: number;
}

export interface SerializationContext {
  stack: number[];
  // Map tree refs to actual refs
  validRefs: number[];
  refSize: number;
  // Refs that are...referenced
  markedRefs: Record<number, number>;
  // Variables
  vars: string[];
  // Array of assignments to be done (used for recursion)
  assignments: Assignment[];
  // Supported features
  features: number;
}

export interface Options {
  target: string | string[];
}

const DEFAULT_OPTIONS: Options = {
  target: 'es2023',
};

export function createParserContext(options: Partial<Options> = {}): ParserContext {
  // eslint-disable-next-line prefer-object-spread
  const result = Object.assign({}, DEFAULT_OPTIONS, options || {});
  return {
    markedRefs: {},
    refs: new Map(),
    features: parseTargets(result.target),
  };
}

export interface SerializationOptions {
  markedRefs: Record<number, number>;
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
    markedRefs: options.markedRefs,
  };
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
