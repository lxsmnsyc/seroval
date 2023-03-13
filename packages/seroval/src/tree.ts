/* eslint-disable no-await-in-loop */
import {
  isIterable,
  isPrimitive,
  isPromise,
  constructorCheck,
} from './checks';
import quote from './quote';
import {
  AsyncServerValue,
  ErrorValue,
  PrimitiveValue,
  ServerValue,
  TypedArrayValue,
} from './types';
import getIdentifier from './get-identifier';
import serializePrimitive from './serialize-primitive';

const EMPTY_SET = 'new Set';
const EMPTY_MAP = 'new Map';

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

const EXCLUDED_ERROR_KEYS = {
  name: true,
  cause: true,
  stack: true,
  message: true,
};

function getErrorOptions(error: Error) {
  let options: Record<string, any> | undefined;
  const constructor = getErrorConstructor(error);
  if (error.name !== constructor) {
    options = { name: error.name };
  } else if (error.constructor.name !== constructor) {
    options = { name: error.constructor.name };
  }
  const names = Object.getOwnPropertyNames(error);
  for (const name of names) {
    if (!(name in EXCLUDED_ERROR_KEYS)) {
      options = options || {};
      options[name] = error[name as keyof Error];
    }
  }
  return options;
}

function getIterableOptions(obj: Iterable<any>) {
  const names = Object.getOwnPropertyNames(obj);
  if (names.length) {
    const options: Record<string, unknown> = {};
    for (const name of names) {
      options[name] = obj[name as unknown as keyof typeof obj];
    }
    return options;
  }
  return undefined;
}

const enum SerovalNodeType {
  Primitive,
  Reference,
  Date,
  RegExp,
  Set,
  Map,
  Array,
  Object,
  NullConstructor,
  Promise,
  Error,
  AggregateError,
  Iterable,
  TypedArray,
}

type SerovalPrimitiveNode = [type: SerovalNodeType.Primitive, value: PrimitiveValue];
type SerovalReferenceNode = [type: SerovalNodeType.Reference, value: number];
type SerovalSemiPrimitiveNode =
  | [type: SerovalNodeType.Date, value: Date, id: number]
  | [type: SerovalNodeType.RegExp, value: RegExp, id: number]
  | [
    type: SerovalNodeType.TypedArray,
    value: { constructor: string, array: TypedArrayValue },
    id: number
  ];

type SerovalNode =
  | SerovalPrimitiveNode
  | SerovalReferenceNode
  | SerovalSemiPrimitiveNode
  | [type: SerovalNodeType.Set, value: SerovalNode[], id: number]
  | [type: SerovalNodeType.Map, value: [key: SerovalNode, value: SerovalNode][], id: number]
  | [type: SerovalNodeType.Array, value: SerovalNode[], id: number]
  | [type: SerovalNodeType.Object, value: Record<string, SerovalNode>, id: number]
  | [type: SerovalNodeType.NullConstructor, value: Record<string, SerovalNode>, id: number]
  | [type: SerovalNodeType.Promise, value: SerovalNode, id: number]
  | [
    type: SerovalNodeType.Error,
    value: {
      constructor: string;
      message: string;
      options?: SerovalNode;
      cause?: SerovalNode;
    },
    id: number
  ]
  | [
    type: SerovalNodeType.AggregateError,
    value: {
      message: string;
      options?: SerovalNode;
      cause?: SerovalNode;
      errors: SerovalNode;
    },
    id: number
  ]
  | [
    type: SerovalNodeType.Iterable,
    value: {
      items: SerovalNode,
      options?: SerovalNode,
    },
    id: number,
  ];

function isReferenceInStack(
  ctx: SerializationContext,
  node: SerovalNode,
): node is SerovalReferenceNode {
  return node[0] === SerovalNodeType.Reference && ctx.stack.includes(node[1]);
}

function generateRef(
  ctx: SerializationContext,
  current: unknown,
): number | SerovalReferenceNode {
  const ref = ctx.refs.has(current);
  if (ref) {
    const refID = ctx.refs.get(current) || 0;
    insertRef(ctx, refID);
    return [SerovalNodeType.Reference, refID];
  }
  const id = ctx.refs.size;
  ctx.refs.set(current, id);
  return id;
}

function generateSemiPrimitiveValue(
  current: unknown,
  id: number,
): SerovalNode | undefined {
  if (constructorCheck<Date>(current, Date)) {
    return [SerovalNodeType.Date, current, id];
  }
  if (constructorCheck<RegExp>(current, RegExp)) {
    return [SerovalNodeType.RegExp, current, id];
  }
  if (constructorCheck<Int8Array>(current, Int8Array)) {
    return [SerovalNodeType.TypedArray, { constructor: 'Int8Array', array: current }, id];
  }
  if (constructorCheck<Int16Array>(current, Int16Array)) {
    return [SerovalNodeType.TypedArray, { constructor: 'Int16Array', array: current }, id];
  }
  if (constructorCheck<Int32Array>(current, Int32Array)) {
    return [SerovalNodeType.TypedArray, { constructor: 'Int32Array', array: current }, id];
  }
  if (constructorCheck<Uint8Array>(current, Uint8Array)) {
    return [SerovalNodeType.TypedArray, { constructor: 'Uint8Array', array: current }, id];
  }
  if (constructorCheck<Uint16Array>(current, Uint16Array)) {
    return [SerovalNodeType.TypedArray, { constructor: 'Uint16Array', array: current }, id];
  }
  if (constructorCheck<Uint32Array>(current, Uint32Array)) {
    return [SerovalNodeType.TypedArray, { constructor: 'Uint32Array', array: current }, id];
  }
  if (constructorCheck<Uint8ClampedArray>(current, Uint8ClampedArray)) {
    return [SerovalNodeType.TypedArray, { constructor: 'Uint8ClampedArray', array: current }, id];
  }
  if (constructorCheck<Float32Array>(current, Float32Array)) {
    return [SerovalNodeType.TypedArray, { constructor: 'Float32Array', array: current }, id];
  }
  if (constructorCheck<Float64Array>(current, Float64Array)) {
    return [SerovalNodeType.TypedArray, { constructor: 'Float64Array', array: current }, id];
  }
  if (constructorCheck<BigInt64Array>(current, BigInt64Array)) {
    return [SerovalNodeType.TypedArray, { constructor: 'BigInt64Array', array: current }, id];
  }
  if (constructorCheck<BigUint64Array>(current, BigUint64Array)) {
    return [SerovalNodeType.TypedArray, { constructor: 'BigUint64Array', array: current }, id];
  }
  return undefined;
}

export function generateTreeSync(
  ctx: SerializationContext,
  current: ServerValue,
): SerovalNode {
  if (isPrimitive(current)) {
    return [SerovalNodeType.Primitive, current];
  }
  const id = generateRef(ctx, current);
  if (Array.isArray(id)) {
    return id;
  }
  const semiPrimitive = generateSemiPrimitiveValue(current, id);
  if (semiPrimitive) {
    return semiPrimitive;
  }
  if (constructorCheck<Set<ServerValue>>(current, Set)) {
    const nodes: SerovalNode[] = [];
    const deferred: ServerValue[] = [];
    for (const item of current.keys()) {
      if (isIterable(item)) {
        deferred.push(item);
      } else {
        nodes.push(generateTreeSync(ctx, item));
      }
    }
    for (const item of deferred) {
      nodes.push(generateTreeSync(ctx, item));
    }
    return [SerovalNodeType.Set, nodes, id];
  }
  if (constructorCheck<Map<ServerValue, ServerValue>>(current, Map)) {
    const nodes: [key: SerovalNode, value: SerovalNode][] = [];
    const deferred: [ServerValue, ServerValue][] = [];
    for (const [key, value] of current.entries()) {
      if (isIterable(key) || isIterable(value)) {
        deferred.push([key, value]);
      } else {
        const keyNode = generateTreeSync(ctx, key);
        const valueNode = generateTreeSync(ctx, value);
        nodes.push([keyNode, valueNode]);
      }
    }
    for (const [key, value] of deferred) {
      const keyNode = generateTreeSync(ctx, key);
      const valueNode = generateTreeSync(ctx, value);
      nodes.push([keyNode, valueNode]);
    }
    return [SerovalNodeType.Map, nodes, id];
  }
  if (Array.isArray(current)) {
    const nodes = new Array<SerovalNode>(current.length);
    const deferred = new Array<ServerValue>(current.length);
    for (const [key, item] of current.entries()) {
      if (key in current) {
        if (isIterable(item)) {
          deferred[key] = item;
        } else {
          nodes[key] = generateTreeSync(ctx, item);
        }
      }
    }
    for (const [key, item] of deferred.entries()) {
      if (key in deferred) {
        nodes[key] = generateTreeSync(ctx, item);
      }
    }
    return [SerovalNodeType.Array, nodes, id];
  }
  if (current instanceof AggregateError) {
    const options = getErrorOptions(current);
    return [SerovalNodeType.AggregateError, {
      message: current.message,
      options: options
        ? generateTreeSync(ctx, options)
        : undefined,
      cause: 'cause' in current
        ? generateTreeSync(ctx, { cause: current.cause as ServerValue })
        : undefined,
      errors: generateTreeSync(ctx, current.errors as ServerValue),
    }, id];
  }
  if (current instanceof Error) {
    const options = getErrorOptions(current);
    return [SerovalNodeType.Error, {
      constructor: getErrorConstructor(current),
      message: current.message,
      options: options ? generateTreeSync(ctx, options) : undefined,
      cause: 'cause' in current
        ? generateTreeSync(ctx, { cause: current.cause as ServerValue })
        : undefined,
    }, id];
  }
  if (isIterable(current)) {
    const options = getIterableOptions(current);
    return [SerovalNodeType.Iterable, {
      options: options
        ? generateTreeSync(ctx, options as ServerValue)
        : undefined,
      items: generateTreeSync(ctx, Array.from(current)),
    }, id];
  }
  const empty = current.constructor == null;
  if (current.constructor === Object || empty) {
    const nodes: Record<string, SerovalNode> = {};
    const deferred: Record<string, ServerValue> = {};
    for (const [key, item] of Object.entries(current)) {
      if (isIterable(item)) {
        deferred[key] = item as ServerValue;
      } else {
        nodes[key] = generateTreeSync(ctx, item as ServerValue);
      }
    }
    for (const [key, item] of Object.entries(deferred)) {
      nodes[key] = generateTreeSync(ctx, item);
    }
    return [
      empty ? SerovalNodeType.NullConstructor : SerovalNodeType.Object,
      nodes,
      id,
    ];
  }
  throw new Error('Unsupported value');
}

export async function generateTreeAsync(
  ctx: SerializationContext,
  current: AsyncServerValue,
): Promise<SerovalNode> {
  if (isPrimitive(current)) {
    return [SerovalNodeType.Primitive, current];
  }
  const id = generateRef(ctx, current);
  if (Array.isArray(id)) {
    return id;
  }
  const semiPrimitive = generateSemiPrimitiveValue(current, id);
  if (semiPrimitive) {
    return semiPrimitive;
  }
  if (isPromise(current)) {
    return current.then(async (value) => [
      SerovalNodeType.Promise,
      await generateTreeAsync(ctx, value),
      id,
    ]);
  }
  if (constructorCheck<Set<ServerValue>>(current, Set)) {
    const nodes: SerovalNode[] = [];
    const deferred: ServerValue[] = [];
    for (const item of current.keys()) {
      if (isIterable(item)) {
        deferred.push(item);
      } else {
        nodes.push(await generateTreeAsync(ctx, item));
      }
    }
    for (const item of deferred) {
      nodes.push(await generateTreeAsync(ctx, item));
    }
    return [SerovalNodeType.Set, nodes, id];
  }
  if (constructorCheck<Map<ServerValue, ServerValue>>(current, Map)) {
    const nodes: [key: SerovalNode, value: SerovalNode][] = [];
    const deferred: [ServerValue, ServerValue][] = [];
    for (const [key, value] of current.entries()) {
      if (isIterable(key) || isIterable(value)) {
        deferred.push([key, value]);
      } else {
        const keyNode = await generateTreeAsync(ctx, key);
        const valueNode = await generateTreeAsync(ctx, value);
        nodes.push([keyNode, valueNode]);
      }
    }
    for (const [key, value] of deferred) {
      const keyNode = await generateTreeAsync(ctx, key);
      const valueNode = await generateTreeAsync(ctx, value);
      nodes.push([keyNode, valueNode]);
    }
    return [SerovalNodeType.Map, nodes, id];
  }
  if (Array.isArray(current)) {
    const nodes = new Array<SerovalNode>(current.length);
    const deferred = new Array<AsyncServerValue>(current.length);
    for (const [key, item] of current.entries()) {
      if (key in current) {
        if (isIterable(item)) {
          deferred[key] = item;
        } else {
          nodes[key] = await generateTreeAsync(ctx, item);
        }
      }
    }
    for (const [key, item] of deferred.entries()) {
      if (key in deferred) {
        nodes[key] = await generateTreeAsync(ctx, item);
      }
    }
    return [SerovalNodeType.Array, nodes, id];
  }
  if (current instanceof AggregateError) {
    const options = getErrorOptions(current);
    return [SerovalNodeType.AggregateError, {
      message: current.message,
      options: options
        ? generateTreeSync(ctx, options)
        : undefined,
      cause: 'cause' in current
        ? await generateTreeAsync(ctx, { cause: current.cause as ServerValue })
        : undefined,
      errors: await generateTreeAsync(ctx, current.errors as ServerValue),
    }, id];
  }
  if (current instanceof Error) {
    const options = getErrorOptions(current);
    return [SerovalNodeType.Error, {
      constructor: getErrorConstructor(current),
      message: current.message,
      options: options ? await generateTreeAsync(ctx, options) : undefined,
      cause: 'cause' in current
        ? await generateTreeAsync(ctx, { cause: current.cause as ServerValue })
        : undefined,
    }, id];
  }
  if (isIterable(current)) {
    const options = getIterableOptions(current);
    return [SerovalNodeType.Iterable, {
      options: options
        ? await generateTreeAsync(ctx, options as ServerValue)
        : undefined,
      items: await generateTreeAsync(ctx, Array.from(current)),
    }, id];
  }
  const empty = current.constructor == null;
  if (current.constructor === Object || empty) {
    const nodes: Record<string, SerovalNode> = {};
    const deferred: Record<string, AsyncServerValue> = {};
    for (const [key, item] of Object.entries(current)) {
      if (isIterable(item)) {
        deferred[key] = item as ServerValue;
      } else {
        nodes[key] = await generateTreeAsync(ctx, item as ServerValue);
      }
    }
    for (const [key, item] of Object.entries(deferred)) {
      nodes[key] = await generateTreeAsync(ctx, item);
    }
    return [
      empty ? SerovalNodeType.NullConstructor : SerovalNodeType.Object,
      nodes,
      id,
    ];
  }
  throw new Error('Unsupported value');
}

export function serializeTree(
  ctx: SerializationContext,
  [type, value, id]: SerovalNode,
): string {
  switch (type) {
    case SerovalNodeType.Primitive:
      return serializePrimitive(value);
    case SerovalNodeType.Reference:
      return getRefParam(ctx, value);
    case SerovalNodeType.Promise: {
      let serialized: string;
      if (isReferenceInStack(ctx, value)) {
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
    case SerovalNodeType.Date: {
      const serialized = `new Date("${value.toISOString()}")`;
      if (hasRefs(ctx, id)) {
        return assignRef(ctx, id, serialized);
      }
      return serialized;
    }
    case SerovalNodeType.RegExp: {
      const serialized = String(value);
      if (hasRefs(ctx, id)) {
        return assignRef(ctx, id, serialized);
      }
      return serialized;
    }
    case SerovalNodeType.TypedArray: {
      const values = [...value.array].map(serializePrimitive).join(',');
      let args = `[${values}]`;
      if (value.array.byteOffset !== 0) {
        args += `,${value.array.byteOffset}`;
      }
      const serialized = `new ${value.constructor}(${args})`;
      if (hasRefs(ctx, id)) {
        return assignRef(ctx, id, serialized);
      }
      return serialized;
    }
    case SerovalNodeType.Set: {
      let serialized = EMPTY_SET;
      if (value.length) {
        const values: string[] = [];
        ctx.stack.push(id);
        for (const item of value) {
          if (isReferenceInStack(ctx, item)) {
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
    case SerovalNodeType.Map: {
      let serialized = EMPTY_MAP;
      if (value.length) {
        const values: string[] = [];
        ctx.stack.push(id);
        for (const [key, val] of value) {
          if (isReferenceInStack(ctx, key)) {
            insertRef(ctx, id);
            const keyRef = getRefParam(ctx, key[1]);
            if (isReferenceInStack(ctx, val)) {
              const valueRef = getRefParam(ctx, val[1]);
              createMapSet(ctx, id, keyRef, valueRef);
            } else {
              const parent = ctx.stack;
              ctx.stack = [];
              createMapSet(ctx, id, keyRef, serializeTree(ctx, val));
              ctx.stack = parent;
            }
          } else if (isReferenceInStack(ctx, val)) {
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
    case SerovalNodeType.Array: {
      let values = '';

      ctx.stack.push(id);
      for (let i = 0, len = value.length; i < len; i++) {
        const item = value[i];
        if (i in value) {
          if (isReferenceInStack(ctx, item)) {
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
    case SerovalNodeType.AggregateError: {
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
    case SerovalNodeType.Error: {
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
    case SerovalNodeType.Iterable: {
      const parent = ctx.stack;
      ctx.stack = [];
      const values = serializeTree(ctx, value.items);
      ctx.stack = parent;
      let serialized = `{[Symbol.iterator]:()=>${values}.values()}`;
      if (value.options) {
        ctx.stack.push(id);
        const options = serializeTree(ctx, value.options);
        ctx.stack.pop();
        serialized = `Object.assign(${serialized},${options})`;
      }
      if (hasRefs(ctx, id)) {
        return assignRef(ctx, id, serialized);
      }
      return serialized;
    }
    case SerovalNodeType.NullConstructor:
    case SerovalNodeType.Object: {
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
          if (isReferenceInStack(ctx, val)) {
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
        } else if (isReferenceInStack(ctx, val)) {
          insertRef(ctx, id);
          const refParam = getRefParam(ctx, val[1]);
          createObjectComputedAssign(ctx, id, quote(key), refParam);
        } else {
          values.push(`${quote(key)}:${serializeTree(ctx, val)}`);
        }
      }
      ctx.stack.pop();
      let serialized = `{${values.join(',')}}`;
      if (type === SerovalNodeType.NullConstructor) {
        serialized = `Object.assign(Object.create(null),${serialized})`;
      }
      if (hasRefs(ctx, id)) {
        return assignRef(ctx, id, serialized);
      }
      return serialized;
    }
    default:
      throw new Error('Unsupported type');
  }
}