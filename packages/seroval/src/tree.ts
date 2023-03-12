/* eslint-disable no-await-in-loop */
import isPrimitive from './is-primitive';
import isPromise from './is-promise';
import quote from './quote';
import {
  AsyncServerValue,
  ErrorValue,
  PrimitiveValue,
  ServerValue,
} from './types';
import getIdentifier from './get-identifier';
import serializePrimitive from './serialize-primitive';

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
  stack: number[];
  // Value-to-ref map
  refs: Map<unknown, number>;
  // Map tree refs to actual refs
  validRefs: Map<number, number>;
  // Reference counter
  refCount: number[];
  // Variables
  vars: string[];
  // Array of assignments to be done (used for recursion)
  assignments: Assignment[];
}

export function createSerializationContext(): SerializationContext {
  return {
    refCount: [],
    stack: [],
    refs: new Map(),
    vars: [],
    assignments: [],
    validRefs: new Map(),
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

function insertRef(ctx: SerializationContext, current: number) {
  const count = ctx.refCount[current] || 0;
  ctx.refCount[current] = count + 1;
}

function hasRefs(ctx: SerializationContext, current: number) {
  return (ctx.refCount[current] || 0) >= 1;
}

function constructorCheck<T extends NonNullable<AsyncServerValue>>(
  value: NonNullable<AsyncServerValue>,
  constructor: unknown,
): value is T {
  return value.constructor === constructor;
}

export function createRef(
  ctx: SerializationContext,
  index: unknown,
) {
  const current = ctx.refs.get(index);
  if (current != null) {
    return current;
  }
  const id = ctx.refs.size;
  ctx.refs.set(index, id);
  return id;
}

function createValidRef(
  ctx: SerializationContext,
  index: number,
) {
  const current = ctx.validRefs.get(index);
  if (current != null) {
    return current;
  }
  const id = ctx.validRefs.size;
  ctx.validRefs.set(index, id);
  return id;
}

export function getRefParam(ctx: SerializationContext, index: number) {
  const actualIndex = createValidRef(ctx, index);
  if (ctx.vars[actualIndex]) {
    return ctx.vars[actualIndex];
  }
  const result = getIdentifier(actualIndex);
  ctx.vars[actualIndex] = result;
  return result;
}

function assignRef(
  ctx: SerializationContext,
  index: number,
  value: string,
) {
  return `${getRefParam(ctx, index)}=${value}`;
}

function createAssignment(
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

function createSetAdd(
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

function createMapSet(
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

function createArrayAssign(
  ctx: SerializationContext,
  ref: number,
  index: number,
  value: string,
) {
  createAssignment(ctx, `${getRefParam(ctx, ref)}[${index}]`, value);
}

function createObjectIdentifierAssign(
  ctx: SerializationContext,
  ref: number,
  key: string,
  value: string,
) {
  createAssignment(ctx, `${getRefParam(ctx, ref)}.${key}`, value);
}

function createObjectComputedAssign(
  ctx: SerializationContext,
  ref: number,
  key: string,
  value: string,
) {
  createAssignment(ctx, `${getRefParam(ctx, ref)}[${key}]`, value);
}

function getErrorConstructor(error: ErrorValue) {
  if (error instanceof EvalError) {
    return 'EvalError';
  }
  if (error instanceof RangeError) {
    return 'RangeError';
  }
  if (error instanceof ReferenceError) {
    return 'ReferenceError';
  }
  if (error instanceof SyntaxError) {
    return 'SyntaxError';
  }
  if (error instanceof TypeError) {
    return 'TypeError';
  }
  if (error instanceof URIError) {
    return 'URIError';
  }
  return 'Error';
}

type SerovalNode =
  | [type: 'primitive', value: PrimitiveValue]
  | [type: 'reference', value: number]
  | [type: 'Date', value: Date, id: number]
  | [type: 'RegExp', value: RegExp, id: number]
  | [type: 'Set', value: SerovalNode[], id: number]
  | [type: 'Map', value: [key: SerovalNode, value: SerovalNode][], id: number]
  | [type: 'Array', value: SerovalNode[], id: number]
  | [type: 'Object', value: Record<string, SerovalNode>, id: number]
  | [type: 'NullConstructor', value: Record<string, SerovalNode>, id: number]
  | [type: 'Promise', value: SerovalNode, id: number]
  | [
    type: 'Error',
    value: {
      constructor: string;
      message: string;
      options?: SerovalNode;
      cause?: SerovalNode;
    },
    id: number
  ]
  | [
    type: 'AggregateError',
    value: {
      message: string;
      options?: SerovalNode;
      cause?: SerovalNode;
      errors: SerovalNode;
    },
    id: number
  ];

export function generateTreeSync(
  ctx: SerializationContext,
  current: ServerValue,
): SerovalNode {
  if (isPrimitive(current)) {
    return ['primitive', current];
  }
  const ref = ctx.refs.has(current);
  if (ref) {
    const refID = ctx.refs.get(current) || 0;
    insertRef(ctx, refID);
    return ['reference', refID];
  }
  const id = ctx.refs.size;
  ctx.refs.set(current, id);
  if (constructorCheck<Date>(current, Date)) {
    return ['Date', current, id];
  }
  if (constructorCheck<RegExp>(current, RegExp)) {
    return ['RegExp', current, id];
  }
  if (constructorCheck<Set<ServerValue>>(current, Set)) {
    const nodes: SerovalNode[] = [];
    for (const item of current.keys()) {
      nodes.push(generateTreeSync(ctx, item));
    }
    return ['Set', nodes, id];
  }
  if (constructorCheck<Map<ServerValue, ServerValue>>(current, Map)) {
    const nodes: [key: SerovalNode, value: SerovalNode][] = [];
    for (const [key, value] of current.entries()) {
      const keyNode = generateTreeSync(ctx, key);
      const valueNode = generateTreeSync(ctx, value);
      nodes.push([keyNode, valueNode]);
    }
    return ['Map', nodes, id];
  }
  if (Array.isArray(current)) {
    const nodes = new Array<SerovalNode>(current.length);
    for (const [key, item] of current.entries()) {
      if (key in current) {
        nodes[key] = generateTreeSync(ctx, item);
      }
    }
    return ['Array', nodes, id];
  }
  if (current instanceof AggregateError) {
    return ['AggregateError', {
      message: current.message,
      options:
        current.name !== 'AggregateError'
          ? generateTreeSync(ctx, { name: current.name })
          : undefined,
      cause: 'cause' in current
        ? generateTreeSync(ctx, { cause: current.cause as ServerValue })
        : undefined,
      errors: generateTreeSync(ctx, current.errors as ServerValue),
    }, id];
  }
  if (current instanceof Error) {
    let options: Record<string, any> | undefined;
    for (const name of Object.getOwnPropertyNames(current)) {
      if (!(name === 'message' || name === 'cause' || name === 'stack')) {
        options = options || {};
        options[name] = current[name as keyof Error];
      }
    }
    return ['Error', {
      constructor: getErrorConstructor(current),
      message: current.message,
      options: options ? generateTreeSync(ctx, options) : undefined,
      cause: 'cause' in current
        ? generateTreeSync(ctx, { cause: current.cause as ServerValue })
        : undefined,
    }, id];
  }
  const empty = current.constructor == null;
  if (current.constructor === Object || empty) {
    const nodes: Record<string, SerovalNode> = {};
    for (const [key, item] of Object.entries(current)) {
      nodes[key] = generateTreeSync(ctx, item);
    }
    return [empty ? 'NullConstructor' : 'Object', nodes, id];
  }
  throw new Error('Unsupported value');
}

export async function generateTreeAsync(
  ctx: SerializationContext,
  current: AsyncServerValue,
): Promise<SerovalNode> {
  if (isPrimitive(current)) {
    return ['primitive', current];
  }
  const ref = ctx.refs.has(current);
  if (ref) {
    const refID = ctx.refs.get(current) || 0;
    insertRef(ctx, refID);
    return ['reference', refID];
  }
  const id = ctx.refs.size;
  ctx.refs.set(current, id);
  if (isPromise(current)) {
    return current.then(async (value) => ['Promise', await generateTreeAsync(ctx, value), id]);
  }
  if (constructorCheck<Date>(current, Date)) {
    return ['Date', current, id];
  }
  if (constructorCheck<RegExp>(current, RegExp)) {
    return ['RegExp', current, id];
  }
  if (constructorCheck<Set<ServerValue>>(current, Set)) {
    const nodes: SerovalNode[] = [];
    for (const item of current.keys()) {
      nodes.push(await generateTreeAsync(ctx, item));
    }
    return ['Set', nodes, id];
  }
  if (constructorCheck<Map<ServerValue, ServerValue>>(current, Map)) {
    const nodes: [key: SerovalNode, value: SerovalNode][] = [];
    for (const [key, value] of current.entries()) {
      const keyNode = await generateTreeAsync(ctx, key);
      const valueNode = await generateTreeAsync(ctx, value);
      nodes.push([keyNode, valueNode]);
    }
    return ['Map', nodes, id];
  }
  if (Array.isArray(current)) {
    const nodes = new Array<SerovalNode>(current.length);
    for (const [key, item] of current.entries()) {
      if (key in current) {
        nodes[key] = await generateTreeAsync(ctx, item);
      }
    }
    return ['Array', nodes, id];
  }
  if (current instanceof AggregateError) {
    return ['AggregateError', {
      message: current.message,
      options: current.name !== 'AggregateError'
        ? generateTreeSync(ctx, { name: current.name })
        : undefined,
      cause: 'cause' in current
        ? await generateTreeAsync(ctx, { cause: current.cause as ServerValue })
        : undefined,
      errors: await generateTreeAsync(ctx, current.errors as ServerValue),
    }, id];
  }
  if (current instanceof Error) {
    let options: Record<string, any> | undefined;
    for (const name of Object.getOwnPropertyNames(current)) {
      if (!(name === 'message' || name === 'cause' || name === 'stack')) {
        options = options || {};
        options[name] = current[name as keyof Error];
      }
    }
    return ['Error', {
      constructor: getErrorConstructor(current),
      message: current.message,
      options: options ? await generateTreeAsync(ctx, options) : undefined,
      cause: 'cause' in current
        ? await generateTreeAsync(ctx, { cause: current.cause as ServerValue })
        : undefined,
    }, id];
  }
  const empty = current.constructor == null;
  if (current.constructor === Object || empty) {
    const nodes: Record<string, SerovalNode> = {};
    for (const [key, item] of Object.entries(current)) {
      nodes[key] = await generateTreeAsync(ctx, item as ServerValue);
    }
    return [empty ? 'NullConstructor' : 'Object', nodes, id];
  }
  throw new Error('Unsupported value');
}

export function serializeTree(
  ctx: SerializationContext,
  [type, value, id]: SerovalNode,
): string {
  if (type === 'primitive') {
    return serializePrimitive(value);
  }
  if (type === 'reference') {
    return getRefParam(ctx, value);
  }
  if (type === 'Promise') {
    let serialized: string;
    if (value[0] === 'reference' && ctx.stack.includes(value[1])) {
      serialized = `Promise.resolve().then(()=>${getRefParam(ctx, value[1])})`;
    } else {
      ctx.stack.push(id);
      const result = serializeTree(ctx, value);
      ctx.stack.pop();
      serialized = `Promise.resolve(${result})`;
    }
    if (hasRefs(ctx, id)) {
      return assignRef(ctx, id, serialized);
    }
    return serialized;
  }
  if (type === 'Date') {
    const serialized = `new Date("${value.toISOString()}")`;
    if (hasRefs(ctx, id)) {
      return assignRef(ctx, id, serialized);
    }
    return serialized;
  }
  if (type === 'RegExp') {
    const serialized = String(value);
    if (hasRefs(ctx, id)) {
      return assignRef(ctx, id, serialized);
    }
    return serialized;
  }
  if (type === 'Set') {
    let serialized = EMPTY_SET;
    if (value.length) {
      const values: string[] = [];
      ctx.stack.push(id);
      for (const item of value) {
        if (item[0] === 'reference' && ctx.stack.includes(item[1])) {
          // Received a ref, this might be a recursive ref, defer an assignment
          insertRef(ctx, id);
          createSetAdd(ctx, id, getRefParam(ctx, item[1]));
        } else {
          values.push(serializeTree(ctx, item));
        }
      }
      ctx.stack.pop();
      if (values.length) {
        serialized = `new Set([${values.join(',')}])`;
      }
    }
    if (hasRefs(ctx, id)) {
      return assignRef(ctx, id, serialized);
    }
    return serialized;
  }
  if (type === 'Map') {
    let serialized = EMPTY_MAP;
    if (value.length) {
      const values: string[] = [];
      ctx.stack.push(id);
      for (const [key, val] of value) {
        if (key[0] === 'reference' && ctx.stack.includes(key[1])) {
          insertRef(ctx, id);
          const keyRef = getRefParam(ctx, key[1]);
          if (val[0] === 'reference' && ctx.stack.includes(val[1])) {
            const valueRef = getRefParam(ctx, val[1]);
            createMapSet(ctx, id, keyRef, valueRef);
          } else {
            const parent = ctx.stack;
            ctx.stack = [];
            createMapSet(ctx, id, keyRef, serializeTree(ctx, val));
            ctx.stack = parent;
          }
        } else if (val[0] === 'reference' && ctx.stack.includes(val[1])) {
          insertRef(ctx, id);
          const valueRef = getRefParam(ctx, val[1]);
          const parent = ctx.stack;
          ctx.stack = [];
          createMapSet(ctx, id, serializeTree(ctx, key), valueRef);
          ctx.stack = parent;
        } else {
          values.push(`[${serializeTree(ctx, key)},${serializeTree(ctx, val)}]`);
        }
      }
      ctx.stack.pop();
      if (values.length) {
        serialized = `new Map([${values.join(',')}])`;
      }
    }
    if (hasRefs(ctx, id)) {
      return assignRef(ctx, id, serialized);
    }
    return serialized;
  }
  if (type === 'Array') {
    let values = '';

    ctx.stack.push(id);
    for (let i = 0, len = value.length; i < len; i++) {
      const item = value[i];
      if (i in value) {
        if (item[0] === 'reference' && ctx.stack.includes(item[1])) {
          insertRef(ctx, id);
          createArrayAssign(ctx, id, i, getRefParam(ctx, item[1]));
          values += ',';
        } else {
          values += serializeTree(ctx, item);
          if (i < value.length - 1) {
            values += ',';
          }
        }
      } else {
        values += ',';
      }
    }
    ctx.stack.pop();
    const serialized = `[${values}]`;
    if (hasRefs(ctx, id)) {
      return assignRef(ctx, id, serialized);
    }
    return serialized;
  }
  if (type === 'AggregateError') {
    const args = [serializeTree(ctx, value.errors), quote(value.message)];

    if (value.cause) {
      args.push(serializeTree(ctx, value.cause));
    }
    let serialized = `new AggregateError(${args.join(',')})`;
    if (value.options) {
      const options = serializeTree(ctx, value.options);
      serialized = `Object.assign(${serialized},${options})`;
    }

    if (hasRefs(ctx, id)) {
      return assignRef(ctx, id, serialized);
    }
    return serialized;
  }
  if (type === 'Error') {
    const args = [quote(value.message)];
    if (value.cause) {
      args.push(serializeTree(ctx, value.cause));
    }
    let serialized = `new ${value.constructor}(${args.join(',')})`;
    if (value.options) {
      const options = serializeTree(ctx, value.options);
      serialized = `Object.assign(${serialized},${options})`;
    }

    if (hasRefs(ctx, id)) {
      return assignRef(ctx, id, serialized);
    }
    return serialized;
  }
  if (type === 'NullConstructor' || type === 'Object') {
    const values: string[] = [];

    ctx.stack.push(id);
    for (const [key, val] of Object.entries(value)) {
      const check = Number(key);
      // Test if key is a valid number or JS identifier
      // so that we don't have to serialize the key and wrap with brackets
      if (
        check >= 0
        || (Number.isNaN(check) && /^([$A-Z_][0-9A-Z_$]*)$/i.test(key))
      ) {
        if (val[0] === 'reference' && ctx.stack.includes(val[1])) {
          insertRef(ctx, id);
          const refParam = getRefParam(ctx, val[1]);
          if (!Number.isNaN(check)) {
            createObjectComputedAssign(ctx, id, key, refParam);
          } else {
            createObjectIdentifierAssign(ctx, id, key, refParam);
          }
        } else {
          values.push(`${key}:${serializeTree(ctx, val)}`);
        }
      } else if (val[0] === 'reference' && ctx.stack.includes(val[1])) {
        insertRef(ctx, id);
        const refParam = getRefParam(ctx, val[1]);
        createObjectComputedAssign(ctx, id, quote(key), refParam);
      } else {
        values.push(`${quote(key)}:${serializeTree(ctx, val)}`);
      }
    }
    ctx.stack.pop();
    let serialized = `{${values.join(',')}}`;
    if (type === 'NullConstructor') {
      serialized = `Object.assign(Object.create(null),${serialized})`;
    }
    if (hasRefs(ctx, id)) {
      return assignRef(ctx, id, serialized);
    }
    return serialized;
  }
  throw new Error('Unsupported type');
}
