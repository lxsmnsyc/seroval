import getIdentifier from './get-identifier';
import { AsyncServerValue } from './types';

export const EMPTY_SET = 'new Set';
export const EMPTY_MAP = 'new Map';

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

export interface SerializationContext {
  stack: unknown[];
  // Set to check if ref id already has an assigned value
  assignedRefs: Set<number>;
  // Variables
  vars: string[];
  // Array of assignments to be done (used for recursion)
  assignments: Assignment[];
  // Reference counter
  refCount: Map<unknown, number>;
  // Value-to-ref map
  refs: Map<unknown, number>;
}

export function createSerializationContext(): SerializationContext {
  return {
    refCount: new Map(),
    stack: [],
    refs: new Map(),
    assignedRefs: new Set(),
    vars: [],
    assignments: [],
  };
}

function getAssignmentExpression(assignment: Assignment): string {
  switch (assignment.type) {
    case 'index':
      return `${assignment.source}=${assignment.value}`;
    case 'map':
      return `${assignment.source}.set(${assignment.key},${assignment.value})`;
    case 'set':
      return `${assignment.source}.add(${assignment.value})`;
    default:
      return '';
  }
}

function mergeAssignments(ctx: SerializationContext) {
  const newAssignments = [];
  let current = ctx.assignments[0];
  let prev = current;
  for (let i = 1, len = ctx.assignments.length; i < len; i += 1) {
    const item = ctx.assignments[i];
    if (item.type === prev.type) {
      if (item.type === 'index' && item.value === prev.value) {
        current = {
          type: 'index',
          source: item.source,
          value: getAssignmentExpression(current),
        };
      } else if (item.type === 'map' && item.source === prev.source) {
        current = {
          type: 'map',
          source: getAssignmentExpression(current),
          key: item.key,
          value: item.value,
        };
      } else if (item.type === 'set' && item.source === prev.source) {
        current = {
          type: 'set',
          source: getAssignmentExpression(current),
          value: item.value,
        };
      } else {
        newAssignments.push(current);
        current = item;
      }
    } else {
      newAssignments.push(current);
      current = item;
    }
    prev = item;
  }

  newAssignments.push(current);

  return newAssignments;
}

export function resolvePatches(ctx: SerializationContext) {
  if (ctx.assignments.length) {
    let result = '';

    for (const assignment of mergeAssignments(ctx)) {
      result += `${getAssignmentExpression(assignment)},`;
    }

    return result;
  }
  return '';
}

export function insertRef(ctx: SerializationContext, current: unknown) {
  const count = ctx.refCount.get(current) || 0;
  ctx.refCount.set(current, count + 1);
  return count === 0;
}

export function constructorCheck<T extends NonNullable<AsyncServerValue>>(
  value: NonNullable<AsyncServerValue>,
  constructor: unknown,
): value is T {
  return value.constructor === constructor;
}

export function createRef(
  ctx: SerializationContext,
  value: unknown,
) {
  const current = ctx.refs.get(value);
  if (current != null) {
    return current;
  }
  const id = ctx.refs.size;
  ctx.refs.set(value, id);
  return id;
}

export function getRefParam(ctx: SerializationContext, index: number) {
  if (ctx.vars[index]) {
    return ctx.vars[index];
  }
  const result = getIdentifier(index);
  ctx.vars[index] = result;
  return result;
}

export function assignRef(
  ctx: SerializationContext,
  index: number,
  value: string,
) {
  return `${getRefParam(ctx, index)}=${value}`;
}

export function createAssignment(
  ctx: SerializationContext,
  source: string,
  value: string,
) {
  ctx.assignments.push({
    type: 'index',
    source,
    value,
  });
}

export function createSetAdd(
  ctx: SerializationContext,
  ref: number,
  value: string,
) {
  ctx.assignments.push({
    type: 'set',
    source: getRefParam(ctx, ref),
    value,
  });
}

export function createMapSet(
  ctx: SerializationContext,
  ref: number,
  key: string,
  value: string,
) {
  ctx.assignments.push({
    type: 'map',
    source: getRefParam(ctx, ref),
    key,
    value,
  });
}

export function createArrayAssign(
  ctx: SerializationContext,
  ref: number,
  index: number,
  value: string,
) {
  createAssignment(ctx, `${getRefParam(ctx, ref)}[${index}]`, value);
}

export function createObjectIdentifierAssign(
  ctx: SerializationContext,
  ref: number,
  key: string,
  value: string,
) {
  createAssignment(ctx, `${getRefParam(ctx, ref)}.${key}`, value);
}

export function createObjectComputedAssign(
  ctx: SerializationContext,
  ref: number,
  key: string,
  value: string,
) {
  createAssignment(ctx, `${getRefParam(ctx, ref)}[${key}]`, value);
}
