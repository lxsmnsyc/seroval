/* eslint-disable guard-for-in */
/* eslint-disable @typescript-eslint/no-for-in-array */
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
import { Feature, parseTargets } from './compat';
import assert from './assert';

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
  // Refs that are...referenced
  markedRefs: boolean[];
  // Variables
  vars: string[];
  // Array of assignments to be done (used for recursion)
  assignments: Assignment[];
  // Supported features
  features: Set<Feature>;
}

export interface Options {
  target: string | string[];
}

const DEFAULT_OPTIONS: Options = {
  target: 'es2023',
};

export function createSerializationContext(options: Partial<Options> = {}): SerializationContext {
  // eslint-disable-next-line prefer-object-spread
  const result = Object.assign({}, DEFAULT_OPTIONS, options || {});
  return {
    markedRefs: [],
    stack: [],
    refs: new Map(),
    vars: [],
    assignments: [],
    validRefs: new Map(),
    features: parseTargets(result.target),
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

function mergeAssignments(assignments: Assignment[]) {
  const newAssignments = [];
  let current = assignments[0];
  let prev = current;
  for (let i = 1, len = assignments.length; i < len; i += 1) {
    const item = assignments[i];
    if (item.type === prev.type) {
      if (item.type === 'index' && item.value === prev.value) {
        // Merge if the right-hand value is the same
        // saves at least 2 chars
        current = {
          type: 'index',
          source: item.source,
          value: getAssignmentExpression(current),
        };
      } else if (item.type === 'map' && item.source === prev.source) {
        // Maps has chaining methods, merge if source is the same
        current = {
          type: 'map',
          source: getAssignmentExpression(current),
          key: item.key,
          value: item.value,
        };
      } else if (item.type === 'set' && item.source === prev.source) {
        // Sets has chaining methods too
        current = {
          type: 'set',
          source: getAssignmentExpression(current),
          value: item.value,
        };
      } else {
        // Different assignment, push current
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

function resolveAssignments(assignments: Assignment[]) {
  if (assignments.length) {
    let result = '';
    for (const assignment of mergeAssignments(assignments)) {
      result += `${getAssignmentExpression(assignment)},`;
    }
    return result;
  }
  return undefined;
}

export function resolvePatches(ctx: SerializationContext) {
  return resolveAssignments(ctx.assignments);
}

/**
 * Increments the number of references the referenced value has
 */
function markRef(ctx: SerializationContext, current: number) {
  ctx.markedRefs[current] = true;
}

/**
 * Creates a reference ID from the given values
 */
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
  const current = ctx.validRefs.get(index);
  if (current != null) {
    return current;
  }
  const id = ctx.validRefs.size;
  ctx.validRefs.set(index, id);
  return id;
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
 * Generates the inlined assignment for the reference
 * This is different from the assignments array as this one
 * signifies creation rather than mutation
 */
function assignRef(
  ctx: SerializationContext,
  index: number,
  value: string,
) {
  if (ctx.markedRefs[index]) {
    return `${getRefParam(ctx, index)}=${value}`;
  }
  return value;
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
  markRef(ctx, ref);
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
  markRef(ctx, ref);
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
  markRef(ctx, ref);
  createAssignment(ctx, `${getRefParam(ctx, ref)}[${index}]`, value);
}

function createObjectIdentifierAssign(
  ctx: SerializationContext,
  ref: number,
  key: string,
  value: string,
) {
  markRef(ctx, ref);
  createAssignment(ctx, `${getRefParam(ctx, ref)}.${key}`, value);
}

function createObjectComputedAssign(
  ctx: SerializationContext,
  ref: number,
  key: string,
  value: string,
) {
  markRef(ctx, ref);
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

function getErrorOptions(
  error: Error,
) {
  let options: Record<string, any> | undefined;
  const constructor = getErrorConstructor(error);
  // Name has been modified
  if (error.name !== constructor) {
    options = { name: error.name };
  } else if (error.constructor.name !== constructor) {
    // Otherwise, name is overriden because
    // the Error class is extended
    options = { name: error.constructor.name };
  }
  const names = Object.getOwnPropertyNames(error);
  for (const name of names) {
    if (name !== 'name' && name !== 'message') {
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
      options?: Record<string, SerovalNode>;
    },
    id: number
  ]
  | [
    type: SerovalNodeType.AggregateError,
    value: {
      message: string;
      options?: Record<string, SerovalNode>;
      errors: SerovalNode;
    },
    id: number
  ]
  | [
    type: SerovalNodeType.Iterable,
    value: {
      items: SerovalNode,
      options?: Record<string, SerovalNode>,
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
  // Check if reference number already exists
  const ref = ctx.refs.has(current);
  if (ref) {
    // Exists, means this value is currently
    // being referenced
    const refID = ctx.refs.get(current) || 0;
    // Mark reference
    markRef(ctx, refID);
    return [SerovalNodeType.Reference, refID];
  }
  // Create a new reference ID
  const id = ctx.refs.size;
  ctx.refs.set(current, id);
  return id;
}

function generateSemiPrimitiveValue(
  ctx: SerializationContext,
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
    assert(ctx.features.has('typed-arrays'), 'Unsupported value type "Int8Array"');
    return [SerovalNodeType.TypedArray, { constructor: 'Int8Array', array: current }, id];
  }
  if (constructorCheck<Int16Array>(current, Int16Array)) {
    assert(ctx.features.has('typed-arrays'), 'Unsupported value type "Int16Array"');
    return [SerovalNodeType.TypedArray, { constructor: 'Int16Array', array: current }, id];
  }
  if (constructorCheck<Int32Array>(current, Int32Array)) {
    assert(ctx.features.has('typed-arrays'), 'Unsupported value type "Int32Array"');
    return [SerovalNodeType.TypedArray, { constructor: 'Int32Array', array: current }, id];
  }
  if (constructorCheck<Uint8Array>(current, Uint8Array)) {
    assert(ctx.features.has('typed-arrays'), 'Unsupported value type "Uint8Array"');
    return [SerovalNodeType.TypedArray, { constructor: 'Uint8Array', array: current }, id];
  }
  if (constructorCheck<Uint16Array>(current, Uint16Array)) {
    assert(ctx.features.has('typed-arrays'), 'Unsupported value type "Uint16Array"');
    return [SerovalNodeType.TypedArray, { constructor: 'Uint16Array', array: current }, id];
  }
  if (constructorCheck<Uint32Array>(current, Uint32Array)) {
    assert(ctx.features.has('typed-arrays'), 'Unsupported value type "Uint32Array"');
    return [SerovalNodeType.TypedArray, { constructor: 'Uint32Array', array: current }, id];
  }
  if (constructorCheck<Uint8ClampedArray>(current, Uint8ClampedArray)) {
    assert(ctx.features.has('typed-arrays'), 'Unsupported value type "Uint8ClampedArray"');
    return [SerovalNodeType.TypedArray, { constructor: 'Uint8ClampedArray', array: current }, id];
  }
  if (constructorCheck<Float32Array>(current, Float32Array)) {
    assert(ctx.features.has('typed-arrays'), 'Unsupported value type "Float32Array"');
    return [SerovalNodeType.TypedArray, { constructor: 'Float32Array', array: current }, id];
  }
  if (constructorCheck<Float64Array>(current, Float64Array)) {
    assert(ctx.features.has('typed-arrays'), 'Unsupported value type "Float64Array"');
    return [SerovalNodeType.TypedArray, { constructor: 'Float64Array', array: current }, id];
  }
  if (constructorCheck<BigInt64Array>(current, BigInt64Array)) {
    assert(
      ctx.features.has('typed-arrays')
      && ctx.features.has('bigint'),
      'Unsupported value type "BigInt64Array"',
    );
    return [SerovalNodeType.TypedArray, { constructor: 'BigInt64Array', array: current }, id];
  }
  if (constructorCheck<BigUint64Array>(current, BigUint64Array)) {
    assert(
      ctx.features.has('typed-arrays')
      && ctx.features.has('bigint'),
      'Unsupported value type "BigUint64Array"',
    );
    return [SerovalNodeType.TypedArray, { constructor: 'BigUint64Array', array: current }, id];
  }
  return undefined;
}

export function generateTreeSync(
  ctx: SerializationContext,
  current: ServerValue,
): SerovalNode {
  function serializeProperties(
    properties: Record<string, unknown>,
  ) {
    const nodes: Record<string, SerovalNode> = {};
    const deferred: Record<string, ServerValue> = {};
    for (const [key, item] of Object.entries(properties)) {
      if (isIterable(item)) {
        deferred[key] = item as ServerValue;
      } else {
        nodes[key] = generateTreeSync(ctx, item as ServerValue);
      }
    }
    for (const [key, item] of Object.entries(deferred)) {
      nodes[key] = generateTreeSync(ctx, item);
    }
    return nodes;
  }
  if (isPrimitive(current)) {
    return [SerovalNodeType.Primitive, current];
  }
  // Non-primitive values needs a reference ID
  // mostly because the values themselves are stateful
  const id = generateRef(ctx, current);
  if (Array.isArray(id)) {
    return id;
  }
  const semiPrimitive = generateSemiPrimitiveValue(ctx, current, id);
  if (semiPrimitive) {
    return semiPrimitive;
  }
  if (constructorCheck<Set<ServerValue>>(current, Set)) {
    assert(ctx.features.has('set'), 'Unsupported type "Set"');
    const nodes: SerovalNode[] = [];
    const deferred: ServerValue[] = [];
    for (const item of current.keys()) {
      // Iterables are lazy, so the evaluation must be deferred
      if (isIterable(item)) {
        deferred.push(item);
      } else {
        nodes.push(generateTreeSync(ctx, item));
      }
    }
    // Parse deferred items
    for (const item of deferred) {
      nodes.push(generateTreeSync(ctx, item));
    }
    return [SerovalNodeType.Set, nodes, id];
  }
  if (constructorCheck<Map<ServerValue, ServerValue>>(current, Map)) {
    assert(ctx.features.has('map'), 'Unsupported type "Map"');
    const nodes: [key: SerovalNode, value: SerovalNode][] = [];
    const deferred: [ServerValue, ServerValue][] = [];
    for (const [key, value] of current.entries()) {
      // Either key or value might be an iterable
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
    for (const key in current) {
      const item = current[key];
      if (isIterable(item)) {
        deferred[key] = item;
      } else {
        nodes[key] = generateTreeSync(ctx, item);
      }
    }
    for (const key in deferred) {
      nodes[key] = generateTreeSync(ctx, deferred[key]);
    }
    return [SerovalNodeType.Array, nodes, id];
  }
  if (current instanceof AggregateError && ctx.features.has('aggregate-error')) {
    const options = getErrorOptions(current);
    return [SerovalNodeType.AggregateError, {
      message: current.message,
      options: options
        ? serializeProperties(options)
        : undefined,
      errors: generateTreeSync(ctx, current.errors as ServerValue),
    }, id];
  }
  if (current instanceof Error) {
    const options = getErrorOptions(current);
    return [SerovalNodeType.Error, {
      constructor: getErrorConstructor(current),
      message: current.message,
      options: options
        ? serializeProperties(options)
        : undefined,
    }, id];
  }
  if (isIterable(current)) {
    assert(ctx.features.has('symbol-iterator'), 'Unsupported type "Iterable"');
    const options = getIterableOptions(current);
    return [SerovalNodeType.Iterable, {
      // Parse options first before the items
      options: options
        ? serializeProperties(options)
        : undefined,
      items: generateTreeSync(ctx, Array.from(current)),
    }, id];
  }
  const empty = current.constructor == null;
  if (current.constructor === Object || empty) {
    return [
      empty ? SerovalNodeType.NullConstructor : SerovalNodeType.Object,
      serializeProperties(current as Record<string, unknown>),
      id,
    ];
  }
  throw new Error('Unsupported value');
}

export async function generateTreeAsync(
  ctx: SerializationContext,
  current: AsyncServerValue,
): Promise<SerovalNode> {
  async function serializeProperties(
    properties: Record<string, unknown>,
  ) {
    const nodes: Record<string, SerovalNode> = {};
    const deferred: Record<string, AsyncServerValue> = {};
    for (const [key, item] of Object.entries(properties)) {
      if (isIterable(item)) {
        deferred[key] = item as AsyncServerValue;
      } else {
        nodes[key] = await generateTreeAsync(ctx, item as AsyncServerValue);
      }
    }
    for (const [key, item] of Object.entries(deferred)) {
      nodes[key] = await generateTreeAsync(ctx, item);
    }
    return nodes;
  }
  if (isPrimitive(current)) {
    return [SerovalNodeType.Primitive, current];
  }
  const id = generateRef(ctx, current);
  if (Array.isArray(id)) {
    return id;
  }
  const semiPrimitive = generateSemiPrimitiveValue(ctx, current, id);
  if (semiPrimitive) {
    return semiPrimitive;
  }
  if (isPromise(current)) {
    assert(ctx.features.has('promise'), 'Unsupported type "Promise"');
    return current.then(async (value) => [
      SerovalNodeType.Promise,
      await generateTreeAsync(ctx, value),
      id,
    ]);
  }
  if (constructorCheck<Set<ServerValue>>(current, Set)) {
    assert(ctx.features.has('set'), 'Unsupported type "Set"');
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
    assert(ctx.features.has('map'), 'Unsupported type "Map"');
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
    for (const key in current) {
      const item = current[key];
      if (isIterable(item)) {
        deferred[key] = item;
      } else {
        nodes[key] = await generateTreeAsync(ctx, item);
      }
    }
    for (const key in deferred) {
      nodes[key] = await generateTreeAsync(ctx, deferred[key]);
    }
    return [SerovalNodeType.Array, nodes, id];
  }
  if (current instanceof AggregateError) {
    const options = getErrorOptions(current);
    return [SerovalNodeType.AggregateError, {
      message: current.message,
      options: options
        ? await serializeProperties(options)
        : undefined,
      errors: await generateTreeAsync(ctx, current.errors as ServerValue),
    }, id];
  }
  if (current instanceof Error) {
    const options = getErrorOptions(current);
    return [SerovalNodeType.Error, {
      constructor: getErrorConstructor(current),
      message: current.message,
      options: options
        ? await serializeProperties(options)
        : undefined,
    }, id];
  }
  if (isIterable(current)) {
    assert(ctx.features.has('symbol-iterator'), 'Unsupported type "Iterable"');
    const options = getIterableOptions(current);
    return [SerovalNodeType.Iterable, {
      options: options
        ? await serializeProperties(options)
        : undefined,
      items: await generateTreeAsync(ctx, Array.from(current)),
    }, id];
  }
  const empty = current.constructor == null;
  if (current.constructor === Object || empty) {
    return [
      empty ? SerovalNodeType.NullConstructor : SerovalNodeType.Object,
      await serializeProperties(current as Record<string, unknown>),
      id,
    ];
  }
  throw new Error('Unsupported value');
}

export function serializePrimitive(
  ctx: SerializationContext,
  value: PrimitiveValue,
): string {
  // Shortened forms
  if (value === true) {
    return '!0';
  }
  if (value === false) {
    return '!1';
  }
  if (value === undefined) {
    return 'void 0';
  }
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'bigint') {
    assert(ctx.features.has('bigint'), 'Unsupported type "BigInt"');
    return `${value}n`;
  }
  if (typeof value === 'string') {
    return quote(value);
  }
  // negative 0 isn't the same as 0
  if (Object.is(value, -0)) {
    return '-0';
  }
  if (Object.is(value, Infinity)) {
    return '1/0';
  }
  if (Object.is(value, -Infinity)) {
    return '-1/0';
  }
  return String(value);
}

export function serializeTree(
  ctx: SerializationContext,
  [type, value, id]: SerovalNode,
): string {
  function serializeAssignments(
    targetRef: number,
    source: Record<string, SerovalNode>,
  ) {
    ctx.stack.push(targetRef);
    const mainAssignments: Assignment[] = [];
    for (const [key, val] of Object.entries(source)) {
      const parentStack = ctx.stack;
      ctx.stack = [];
      const refParam = serializeTree(ctx, val);
      ctx.stack = parentStack;
      const check = Number(key);
      // Test if key is a valid number or JS identifier
      // so that we don't have to serialize the key and wrap with brackets
      const parentAssignment = ctx.assignments;
      ctx.assignments = mainAssignments;
      if (
        check >= 0
        || (Number.isNaN(check) && /^([$A-Z_][0-9A-Z_$]*)$/i.test(key))
      ) {
        if (!Number.isNaN(check)) {
          createObjectComputedAssign(ctx, targetRef, key, refParam);
        } else {
          createObjectIdentifierAssign(ctx, targetRef, key, refParam);
        }
      } else {
        createObjectComputedAssign(ctx, targetRef, quote(key), refParam);
      }
      ctx.assignments = parentAssignment;
    }
    ctx.stack.pop();
    return resolveAssignments(mainAssignments);
  }
  function serializeObject(
    sourceID: number,
    source: Record<string, SerovalNode>,
  ) {
    const values: string[] = [];
    ctx.stack.push(sourceID);
    for (const [key, val] of Object.entries(source)) {
      const check = Number(key);
      // Test if key is a valid number or JS identifier
      // so that we don't have to serialize the key and wrap with brackets
      if (
        check >= 0
        || (Number.isNaN(check) && /^([$A-Z_][0-9A-Z_$]*)$/i.test(key))
      ) {
        if (isReferenceInStack(ctx, val)) {
          const refParam = getRefParam(ctx, val[1]);
          if (!Number.isNaN(check)) {
            createObjectComputedAssign(ctx, sourceID, key, refParam);
          } else {
            createObjectIdentifierAssign(ctx, sourceID, key, refParam);
          }
        } else {
          values.push(`${key}:${serializeTree(ctx, val)}`);
        }
      } else if (isReferenceInStack(ctx, val)) {
        const refParam = getRefParam(ctx, val[1]);
        createObjectComputedAssign(ctx, sourceID, quote(key), refParam);
      } else {
        values.push(`${quote(key)}:${serializeTree(ctx, val)}`);
      }
    }
    ctx.stack.pop();
    return `{${values.join(',')}}`;
  }
  switch (type) {
    case SerovalNodeType.Primitive:
      return serializePrimitive(ctx, value);
    case SerovalNodeType.Reference:
      return getRefParam(ctx, value);
    case SerovalNodeType.Promise: {
      let serialized: string;
      // Check if resolved value is a parent expression
      if (isReferenceInStack(ctx, value)) {
        // A Promise trick, reference the value
        // inside the `then` expression so that
        // the Promise evaluates after the parent
        // has initialized
        serialized = `Promise.resolve().then(()=>${getRefParam(ctx, value[1])})`;
      } else {
        ctx.stack.push(id);
        const result = serializeTree(ctx, value);
        ctx.stack.pop();
        // just inline the value/reference here
        serialized = `Promise.resolve(${result})`;
      }
      return assignRef(ctx, id, serialized);
    }
    case SerovalNodeType.Date:
      return assignRef(ctx, id, `new Date("${value.toISOString()}")`);
    case SerovalNodeType.RegExp:
      return assignRef(ctx, id, String(value));
    case SerovalNodeType.TypedArray: {
      // BigInt typed arrays are broken for toString()
      const values = [...value.array].map((val) => serializePrimitive(ctx, val)).join(',');
      let args = `[${values}]`;
      if (value.array.byteOffset !== 0) {
        args += `,${value.array.byteOffset}`;
      }
      return assignRef(ctx, id, `new ${value.constructor}(${args})`);
    }
    case SerovalNodeType.Set: {
      let serialized = 'new Set';
      if (value.length) {
        const values: string[] = [];
        ctx.stack.push(id);
        for (const item of value) {
          if (isReferenceInStack(ctx, item)) {
            createSetAdd(ctx, id, getRefParam(ctx, item[1]));
          } else {
            // Push directly
            values.push(serializeTree(ctx, item));
          }
        }
        ctx.stack.pop();
        if (values.length) {
          serialized += `([${values.join(',')}])`;
        }
      }
      return assignRef(ctx, id, serialized);
    }
    case SerovalNodeType.Map: {
      let serialized = 'new Map';
      if (value.length) {
        const values: string[] = [];
        ctx.stack.push(id);
        for (const [key, val] of value) {
          // Check if key is a parent
          if (isReferenceInStack(ctx, key)) {
            // Create reference for the map instance
            const keyRef = getRefParam(ctx, key[1]);
            // Check if value is a parent
            if (isReferenceInStack(ctx, val)) {
              const valueRef = getRefParam(ctx, val[1]);
              // Register an assignment since
              // both key and value are a parent of this
              // Map instance
              createMapSet(ctx, id, keyRef, valueRef);
            } else {
              // Reset the stack
              // This is required because the serialized
              // value is no longer part of the expression
              // tree and has been moved to the deferred
              // assignment
              const parent = ctx.stack;
              ctx.stack = [];
              createMapSet(ctx, id, keyRef, serializeTree(ctx, val));
              ctx.stack = parent;
            }
          } else if (isReferenceInStack(ctx, val)) {
            // Create ref for the Map instance
            const valueRef = getRefParam(ctx, val[1]);
            // Reset stack for the key serialization
            const parent = ctx.stack;
            ctx.stack = [];
            createMapSet(ctx, id, serializeTree(ctx, key), valueRef);
            ctx.stack = parent;
          } else {
            values.push(`[${serializeTree(ctx, key)},${serializeTree(ctx, val)}]`);
          }
        }
        ctx.stack.pop();
        // Check if there are any values
        // so that the empty Map constructor
        // can be used instead
        if (values.length) {
          serialized += `([${values.join(',')}])`;
        }
      }
      return assignRef(ctx, id, serialized);
    }
    case SerovalNodeType.Array: {
      // This is different than Map and Set
      // because we also need to serialize
      // the holes of the Array
      let values = '';

      ctx.stack.push(id);
      for (let i = 0, len = value.length; i < len; i++) {
        const item = value[i];
        // Check if index is a hole
        if (i in value) {
          // Check if item is a parent
          if (isReferenceInStack(ctx, item)) {
            createArrayAssign(ctx, id, i, getRefParam(ctx, item[1]));
            values += ',';
          } else {
            values += serializeTree(ctx, item);
            if (i < value.length - 1) {
              values += ',';
            }
          }
        } else {
          // Add an empty item
          values += ',';
        }
      }
      ctx.stack.pop();
      return assignRef(ctx, id, `[${values}]`);
    }
    case SerovalNodeType.AggregateError: {
      // Serialize the required arguments
      ctx.stack.push(id);
      const args = [serializeTree(ctx, value.errors), quote(value.message)];
      ctx.stack.pop();
      let serialized = `new AggregateError(${args.join(',')})`;
      // `AggregateError` might've been extended
      // either through class or custom properties
      // Make sure to assign extra properties
      if (value.options) {
        if (ctx.features.has('object-assign')) {
          const options = serializeObject(id, value.options);
          serialized = `Object.assign(${serialized},${options})`;
        } else {
          markRef(ctx, id);
          const assignments = serializeAssignments(id, value.options);
          if (assignments) {
            const ref = getRefParam(ctx, id);
            return `(${assignRef(ctx, id, serialized)},${assignments}${ref})`;
          }
        }
      }
      return assignRef(ctx, id, serialized);
    }
    case SerovalNodeType.Error: {
      let serialized = `new ${value.constructor}(${quote(value.message)})`;
      if (value.options) {
        if (ctx.features.has('object-assign')) {
          const options = serializeObject(id, value.options);
          serialized = `Object.assign(${serialized},${options})`;
        } else {
          markRef(ctx, id);
          const assignments = serializeAssignments(id, value.options);
          if (assignments) {
            const ref = getRefParam(ctx, id);
            return `(${assignRef(ctx, id, serialized)},${assignments}${ref})`;
          }
        }
      }
      return assignRef(ctx, id, serialized);
    }
    case SerovalNodeType.Iterable: {
      const parent = ctx.stack;
      ctx.stack = [];
      const values = serializeTree(ctx, value.items);
      ctx.stack = parent;
      let serialized: string;
      if (ctx.features.has('array-values')) {
        serialized = `${values}.values()`;
      } else {
        serialized = `${values}[Symbol.iterator]()`;
      }
      if (ctx.features.has('arrow-function')) {
        serialized = `{[Symbol.iterator]:()=>${serialized}}`;
      } else if (ctx.features.has('method-shorthand')) {
        serialized = `{[Symbol.iterator](){return ${serialized}}}`;
      } else {
        serialized = `{[Symbol.iterator]:function(){return ${serialized}}}`;
      }
      if (value.options) {
        if (ctx.features.has('object-assign')) {
          const options = serializeObject(id, value.options);
          serialized = `Object.assign(${serialized},${options})`;
        } else {
          markRef(ctx, id);
          const assignments = serializeAssignments(id, value.options);
          if (assignments) {
            const ref = getRefParam(ctx, id);
            return `(${assignRef(ctx, id, serialized)},${assignments}${ref})`;
          }
        }
      }
      return assignRef(ctx, id, serialized);
    }
    case SerovalNodeType.NullConstructor: {
      let serialized = 'Object.create(null)';
      if (ctx.features.has('object-assign')) {
        const fields = serializeObject(id, value);
        if (fields !== '{}') {
          serialized = `Object.assign(${serialized},${fields})`;
        }
      } else {
        markRef(ctx, id);
        const assignments = serializeAssignments(id, value);
        if (assignments) {
          const ref = getRefParam(ctx, id);
          return `(${assignRef(ctx, id, serialized)},${assignments}${ref})`;
        }
      }
      return assignRef(ctx, id, serialized);
    }
    case SerovalNodeType.Object:
      return assignRef(ctx, id, serializeObject(id, value));
    default:
      throw new Error('Unsupported type');
  }
}
