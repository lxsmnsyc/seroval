import getIdentifier from './get-identifier';
import { AsyncServerValue } from './types';

export const EMPTY_SET = 'new Set';
export const EMPTY_MAP = 'new Map';
export const EMPTY_ARRAY = '[]';

// Array of assignments to be done (used for recursion)
export type Assignment = [source: string, value: string];

// Array of Map.prototype.set calls
export type MapSet = [source: string, key: string, value: string];

// Array of Set.prototype.add calls
export type SetAdd = [source: string, value: string];

export interface SerializationContext {
  stack: Set<unknown>;
  // Set to check if ref id already has an assigned value
  assignedRefs: Set<number>;
  // Variables
  vars: string[];
  // Array of assignments to be done (used for recursion)
  assignments: Assignment[];
  // Array of Map.prototype.set calls
  mapSets: MapSet[];
  // Array of Set.prototype.add calls
  setAdds: SetAdd[];
  // Reference counter
  refCount: Map<unknown, number>;
  // Value-to-ref map
  refs: Map<unknown, number>;
}

export function createSerializationContext(): SerializationContext {
  return {
    refCount: new Map(),
    stack: new Set(),
    refs: new Map(),
    assignedRefs: new Set(),
    vars: [],
    assignments: [],
    mapSets: [],
    setAdds: [],
  };
}

export function resolveAssignments(ctx: SerializationContext) {
  if (ctx.assignments.length) {
    const result: Record<string, string> = {};

    // Merge all assignments with similar source
    for (const [source, value] of ctx.assignments) {
      const suffix = value in result
        ? result[value]
        : value;
      result[value] = `${source}=${suffix}`;
    }

    return `${Object.values(result).join(',')},`;
  }
  return '';
}

export function resolveMapSets(ctx: SerializationContext) {
  if (ctx.mapSets.length) {
    const result: Record<string, string> = {};

    // Merge all assignments with similar source
    for (const [source, key, value] of ctx.mapSets) {
      const prefix = source in result
        ? result[source]
        : source;
      result[source] = `${prefix}.set(${key},${value})`;
    }

    return `${Object.values(result).join(',')},`;
  }
  return '';
}

export function resolveSetAdds(ctx: SerializationContext) {
  if (ctx.setAdds.length) {
    const result: Record<string, string> = {};

    // Merge all assignments with similar source
    for (const [source, value] of ctx.setAdds) {
      const prefix = source in result
        ? result[source]
        : source;
      result[source] = `${prefix}.add(${value})`;
    }

    return `${Object.values(result).join(',')},`;
  }
  return '';
}

export function resolvePatches(ctx: SerializationContext) {
  return `${resolveAssignments(ctx)}${resolveMapSets(ctx)}${resolveSetAdds(ctx)}`;
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
  ctx.assignments.push([source, value]);
}

export function createSetAdd(
  ctx: SerializationContext,
  ref: number,
  value: string,
) {
  ctx.setAdds.push([getRefParam(ctx, ref), value]);
}

export function createMapSet(
  ctx: SerializationContext,
  ref: number,
  key: string,
  value: string,
) {
  ctx.mapSets.push([getRefParam(ctx, ref), key, value]);
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
