/* eslint-disable @typescript-eslint/no-use-before-define */
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
  for (let i = 1, len = assignments.length; i < len; i++) {
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
    const merged = mergeAssignments(assignments);
    for (let i = 0, len = merged.length; i < len; i++) {
      result += `${getAssignmentExpression(merged[i])},`;
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

function createObjectAssign(
  ctx: SerializationContext,
  ref: number,
  key: string,
  value: string,
  computed: boolean,
) {
  markRef(ctx, ref);
  const member = computed ? `[${key}]` : `.${key}`;
  createAssignment(ctx, `${getRefParam(ctx, ref)}${member}`, value);
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
    value: [constructor: string, array: TypedArrayValue],
    id: number
  ];

type SerovalDictionaryNode = [key: string[], value: SerovalNode[], size: number];
type SerovalSetNode = [type: SerovalNodeType.Set, value: SerovalNode[], id: number];
type SerovalMapNode = [
  type: SerovalNodeType.Map,
  value: [key: SerovalNode[], value: SerovalNode[], size: number],
  id: number
];
type SerovalArrayNode = [type: SerovalNodeType.Array, value: SerovalNode[], id: number];
type SerovalObjectNode = [type: SerovalNodeType.Object, value: SerovalDictionaryNode, id: number];
type SerovalNullConstructorNode = [
  type: SerovalNodeType.NullConstructor,
  value: SerovalDictionaryNode,
  id: number,
];
type SerovalPromiseNode = [type: SerovalNodeType.Promise, value: SerovalNode, id: number];
type SerovalErrorNode = [
  type: SerovalNodeType.Error,
  value: [
    constructor: string,
    message: string,
    options?: SerovalDictionaryNode,
  ],
  id: number
];
type SerovalAggregateErrorNode = [
  type: SerovalNodeType.AggregateError,
  value: [
    message: string,
    options: SerovalDictionaryNode | undefined,
    errors: SerovalNode,
  ],
  id: number
];

type SerovalIterableNode = [
  type: SerovalNodeType.Iterable,
  value: [
    options: SerovalDictionaryNode | undefined,
    items: SerovalNode,
  ],
  id: number,
];

type SerovalNode =
  | SerovalPrimitiveNode
  | SerovalReferenceNode
  | SerovalSemiPrimitiveNode
  | SerovalSetNode
  | SerovalMapNode
  | SerovalArrayNode
  | SerovalObjectNode
  | SerovalNullConstructorNode
  | SerovalPromiseNode
  | SerovalErrorNode
  | SerovalAggregateErrorNode
  | SerovalIterableNode;

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
    assert(ctx.features.has(Feature.TypedArray), 'Unsupported value type "Int8Array"');
    return [SerovalNodeType.TypedArray, ['Int8Array', current], id];
  }
  if (constructorCheck<Int16Array>(current, Int16Array)) {
    assert(ctx.features.has(Feature.TypedArray), 'Unsupported value type "Int16Array"');
    return [SerovalNodeType.TypedArray, ['Int16Array', current], id];
  }
  if (constructorCheck<Int32Array>(current, Int32Array)) {
    assert(ctx.features.has(Feature.TypedArray), 'Unsupported value type "Int32Array"');
    return [SerovalNodeType.TypedArray, ['Int32Array', current], id];
  }
  if (constructorCheck<Uint8Array>(current, Uint8Array)) {
    assert(ctx.features.has(Feature.TypedArray), 'Unsupported value type "Uint8Array"');
    return [SerovalNodeType.TypedArray, ['Uint8Array', current], id];
  }
  if (constructorCheck<Uint16Array>(current, Uint16Array)) {
    assert(ctx.features.has(Feature.TypedArray), 'Unsupported value type "Uint16Array"');
    return [SerovalNodeType.TypedArray, ['Uint16Array', current], id];
  }
  if (constructorCheck<Uint32Array>(current, Uint32Array)) {
    assert(ctx.features.has(Feature.TypedArray), 'Unsupported value type "Uint32Array"');
    return [SerovalNodeType.TypedArray, ['Uint32Array', current], id];
  }
  if (constructorCheck<Uint8ClampedArray>(current, Uint8ClampedArray)) {
    assert(ctx.features.has(Feature.TypedArray), 'Unsupported value type "Uint8ClampedArray"');
    return [SerovalNodeType.TypedArray, ['Uint8ClampedArray', current], id];
  }
  if (constructorCheck<Float32Array>(current, Float32Array)) {
    assert(ctx.features.has(Feature.TypedArray), 'Unsupported value type "Float32Array"');
    return [SerovalNodeType.TypedArray, ['Float32Array', current], id];
  }
  if (constructorCheck<Float64Array>(current, Float64Array)) {
    assert(ctx.features.has(Feature.TypedArray), 'Unsupported value type "Float64Array"');
    return [SerovalNodeType.TypedArray, ['Float64Array', current], id];
  }
  if (constructorCheck<BigInt64Array>(current, BigInt64Array)) {
    assert(
      ctx.features.has(Feature.TypedArray)
      && ctx.features.has(Feature.BigInt),
      'Unsupported value type "BigInt64Array"',
    );
    return [SerovalNodeType.TypedArray, ['BigInt64Array', current], id];
  }
  if (constructorCheck<BigUint64Array>(current, BigUint64Array)) {
    assert(
      ctx.features.has(Feature.TypedArray)
      && ctx.features.has(Feature.BigInt),
      'Unsupported value type "BigUint64Array"',
    );
    return [SerovalNodeType.TypedArray, ['BigUint64Array', current], id];
  }
  return undefined;
}

function serializePropertiesSync(
  ctx: SerializationContext,
  properties: Record<string, unknown>,
): SerovalDictionaryNode {
  const keys = Object.keys(properties);
  const size = keys.length;
  const keyNodes = new Array<string>(size);
  const valueNodes = new Array<SerovalNode>(size);
  const deferredKeys = new Array<string>(size);
  const deferredValues = new Array<ServerValue>(size);
  let deferredSize = 0;
  let nodesSize = 0;
  for (const key of keys) {
    if (isIterable(properties[key])) {
      deferredKeys[deferredSize] = key;
      deferredValues[deferredSize] = properties[key] as ServerValue;
      deferredSize++;
    } else {
      keyNodes[nodesSize] = key;
      valueNodes[nodesSize] = generateTreeSync(ctx, properties[key] as ServerValue);
      nodesSize++;
    }
  }
  for (let i = 0; i < deferredSize; i++) {
    keyNodes[nodesSize + i] = deferredKeys[i];
    valueNodes[nodesSize + i] = generateTreeSync(ctx, deferredValues[i]);
  }
  return [keyNodes, valueNodes, size];
}

export function generateTreeSync(
  ctx: SerializationContext,
  current: ServerValue,
): SerovalNode {
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
    assert(ctx.features.has(Feature.Set), 'Unsupported type "Set"');
    const len = current.size;
    const nodes = new Array<SerovalNode>(len);
    const deferred = new Array<ServerValue>(len);
    let deferredSize = 0;
    let nodeSize = 0;
    for (const item of current.keys()) {
      // Iterables are lazy, so the evaluation must be deferred
      if (isIterable(item)) {
        deferred[deferredSize++] = item;
      } else {
        nodes[nodeSize++] = generateTreeSync(ctx, item);
      }
    }
    // Parse deferred items
    for (let i = 0; i < deferredSize; i++) {
      nodes[nodeSize + i] = generateTreeSync(ctx, deferred[i]);
    }
    return [SerovalNodeType.Set, nodes, id];
  }
  if (constructorCheck<Map<ServerValue, ServerValue>>(current, Map)) {
    assert(ctx.features.has(Feature.Map), 'Unsupported type "Map"');
    const len = current.size;
    const keyNodes = new Array<SerovalNode>(len);
    const valueNodes = new Array<SerovalNode>(len);
    const deferredKey = new Array<ServerValue>(len);
    const deferredValue = new Array<ServerValue>(len);
    let deferredSize = 0;
    let nodeSize = 0;
    for (const [key, value] of current.entries()) {
      // Either key or value might be an iterable
      if (isIterable(key) || isIterable(value)) {
        deferredKey[deferredSize] = key;
        deferredValue[deferredSize] = value;
        deferredSize++;
      } else {
        keyNodes[nodeSize] = generateTreeSync(ctx, key);
        valueNodes[nodeSize] = generateTreeSync(ctx, value);
        nodeSize++;
      }
    }
    for (let i = 0; i < deferredSize; i++) {
      keyNodes[nodeSize + i] = generateTreeSync(ctx, deferredKey[i]);
      valueNodes[nodeSize + i] = generateTreeSync(ctx, deferredValue[i]);
    }
    return [SerovalNodeType.Map, [keyNodes, valueNodes, len], id];
  }
  if (Array.isArray(current)) {
    const size = current.length;
    const nodes = new Array<SerovalNode>(size);
    const deferred = new Array<ServerValue>(size);
    for (let i = 0; i < size; i++) {
      if (i in current) {
        if (isIterable(current[i])) {
          deferred[i] = current[i];
        } else {
          nodes[i] = generateTreeSync(ctx, current[i]);
        }
      }
    }
    for (let i = 0; i < size; i++) {
      if (i in deferred) {
        nodes[i] = generateTreeSync(ctx, deferred[i]);
      }
    }
    return [SerovalNodeType.Array, nodes, id];
  }
  if (current instanceof AggregateError && ctx.features.has(Feature.AggregateError)) {
    const options = getErrorOptions(current);
    const optionsNode = options
      ? serializePropertiesSync(ctx, options)
      : undefined;
    const errorsNode = generateTreeSync(ctx, current.errors as ServerValue);
    return [SerovalNodeType.AggregateError, [current.message, optionsNode, errorsNode], id];
  }
  if (current instanceof Error) {
    const options = getErrorOptions(current);
    const optionsNode = options
      ? serializePropertiesSync(ctx, options)
      : undefined;
    return [
      SerovalNodeType.Error,
      [getErrorConstructor(current), current.message, optionsNode],
      id,
    ];
  }
  if (isIterable(current)) {
    assert(ctx.features.has(Feature.SymbolIterator), 'Unsupported type "Iterable"');
    const options = getIterableOptions(current);
    return [SerovalNodeType.Iterable, [
      // Parse options first before the items
      options ? serializePropertiesSync(ctx, options) : undefined,
      generateTreeSync(ctx, Array.from(current)),
    ], id];
  }
  const empty = current.constructor == null;
  if (current.constructor === Object || empty) {
    return [
      empty ? SerovalNodeType.NullConstructor : SerovalNodeType.Object,
      serializePropertiesSync(ctx, current as Record<string, unknown>),
      id,
    ];
  }
  throw new Error('Unsupported value');
}

async function serializePropertiesAsync(
  ctx: SerializationContext,
  properties: Record<string, unknown>,
): Promise<SerovalDictionaryNode> {
  const keys = Object.keys(properties);
  const size = keys.length;
  const keyNodes = new Array<string>(size);
  const valueNodes = new Array<SerovalNode>(size);
  const deferredKeys = new Array<string>(size);
  const deferredValues = new Array<ServerValue>(size);
  let deferredSize = 0;
  let nodesSize = 0;
  for (const key of keys) {
    if (isIterable(properties[key])) {
      deferredKeys[deferredSize] = key;
      deferredValues[deferredSize] = properties[key] as ServerValue;
      deferredSize++;
    } else {
      keyNodes[nodesSize] = key;
      valueNodes[nodesSize] = await generateTreeAsync(ctx, properties[key] as ServerValue);
      nodesSize++;
    }
  }
  for (let i = 0; i < deferredSize; i++) {
    keyNodes[nodesSize + i] = deferredKeys[i];
    valueNodes[nodesSize + i] = await generateTreeAsync(ctx, deferredValues[i]);
  }
  return [keyNodes, valueNodes, size];
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
  const semiPrimitive = generateSemiPrimitiveValue(ctx, current, id);
  if (semiPrimitive) {
    return semiPrimitive;
  }
  if (isPromise(current)) {
    assert(ctx.features.has(Feature.Promise), 'Unsupported type "Promise"');
    return current.then(async (value) => [
      SerovalNodeType.Promise,
      await generateTreeAsync(ctx, value),
      id,
    ]);
  }
  if (constructorCheck<Set<AsyncServerValue>>(current, Set)) {
    assert(ctx.features.has(Feature.Set), 'Unsupported type "Set"');
    const len = current.size;
    const nodes = new Array<SerovalNode>(len);
    const deferred = new Array<AsyncServerValue>(len);
    let deferredSize = 0;
    let nodeSize = 0;
    for (const item of current.keys()) {
      // Iterables are lazy, so the evaluation must be deferred
      if (isIterable(item)) {
        deferred[deferredSize++] = item;
      } else {
        nodes[nodeSize++] = await generateTreeAsync(ctx, item);
      }
    }
    // Parse deferred items
    for (let i = 0; i < deferredSize; i++) {
      nodes[nodeSize + i] = await generateTreeAsync(ctx, deferred[i]);
    }
    return [SerovalNodeType.Set, nodes, id];
  }
  if (constructorCheck<Map<AsyncServerValue, AsyncServerValue>>(current, Map)) {
    assert(ctx.features.has(Feature.Map), 'Unsupported type "Map"');
    const len = current.size;
    const keyNodes = new Array<SerovalNode>(len);
    const valueNodes = new Array<SerovalNode>(len);
    const deferredKey = new Array<AsyncServerValue>(len);
    const deferredValue = new Array<AsyncServerValue>(len);
    let deferredSize = 0;
    let nodeSize = 0;
    for (const [key, value] of current.entries()) {
      // Either key or value might be an iterable
      if (isIterable(key) || isIterable(value)) {
        deferredKey[deferredSize] = key;
        deferredValue[deferredSize] = value;
        deferredSize++;
      } else {
        keyNodes[nodeSize] = await generateTreeAsync(ctx, key);
        valueNodes[nodeSize] = await generateTreeAsync(ctx, value);
        nodeSize++;
      }
    }
    for (let i = 0; i < deferredSize; i++) {
      keyNodes[nodeSize + i] = await generateTreeAsync(ctx, deferredKey[i]);
      valueNodes[nodeSize + i] = await generateTreeAsync(ctx, deferredValue[i]);
    }
    return [SerovalNodeType.Map, [keyNodes, valueNodes, len], id];
  }
  if (Array.isArray(current)) {
    const size = current.length;
    const nodes = new Array<SerovalNode>(size);
    const deferred = new Array<AsyncServerValue>(size);
    for (let i = 0; i < size; i++) {
      const item = current[i];
      if (i in current) {
        if (isIterable(item)) {
          deferred[i] = item;
        } else {
          nodes[i] = await generateTreeAsync(ctx, item);
        }
      }
    }
    for (let i = 0; i < size; i++) {
      if (i in deferred) {
        nodes[i] = await generateTreeAsync(ctx, deferred[i]);
      }
    }
    return [SerovalNodeType.Array, nodes, id];
  }
  if (current instanceof AggregateError) {
    const options = getErrorOptions(current);
    const optionsNode = options
      ? await serializePropertiesAsync(ctx, options)
      : undefined;
    const errorsNode = await generateTreeAsync(ctx, current.errors as ServerValue);
    return [SerovalNodeType.AggregateError, [current.message, optionsNode, errorsNode], id];
  }
  if (current instanceof Error) {
    const options = getErrorOptions(current);
    const optionsNode = options
      ? await serializePropertiesAsync(ctx, options)
      : undefined;
    return [
      SerovalNodeType.Error,
      [getErrorConstructor(current), current.message, optionsNode],
      id,
    ];
  }
  if (isIterable(current)) {
    assert(ctx.features.has(Feature.SymbolIterator), 'Unsupported type "Iterable"');
    const options = getIterableOptions(current);
    return [SerovalNodeType.Iterable, [
      options
        ? await serializePropertiesAsync(ctx, options)
        : undefined,
      await generateTreeAsync(ctx, Array.from(current)),
    ], id];
  }
  const empty = current.constructor == null;
  if (current.constructor === Object || empty) {
    return [
      empty ? SerovalNodeType.NullConstructor : SerovalNodeType.Object,
      await serializePropertiesAsync(ctx, current as Record<string, unknown>),
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
    assert(ctx.features.has(Feature.BigInt), 'Unsupported type "BigInt"');
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

const IDENTIFIER_CHECK = /^([$A-Z_][0-9A-Z_$]*)$/i;

function serializeAssignments(
  ctx: SerializationContext,
  targetRef: number,
  [keys, values, size]: SerovalDictionaryNode,
) {
  ctx.stack.push(targetRef);
  const mainAssignments: Assignment[] = [];
  for (let i = 0; i < size; i++) {
    const parentStack = ctx.stack;
    ctx.stack = [];
    const refParam = serializeTree(ctx, values[i]);
    ctx.stack = parentStack;
    const key = keys[i];
    const check = Number(key);
    const parentAssignment = ctx.assignments;
    ctx.assignments = mainAssignments;
    // Test if key is a valid number or JS identifier
    // so that we don't have to serialize the key and wrap with brackets
    const isIdentifier = check >= 0 || IDENTIFIER_CHECK.test(key);
    createObjectAssign(
      ctx,
      targetRef,
      isIdentifier ? key : quote(key),
      refParam,
      !(isIdentifier && Number.isNaN(check)),
    );
    ctx.assignments = parentAssignment;
  }
  ctx.stack.pop();
  return resolveAssignments(mainAssignments);
}

function serializeObject(
  ctx: SerializationContext,
  sourceID: number,
  [keys, values, size]: SerovalDictionaryNode,
) {
  let result = '';
  ctx.stack.push(sourceID);
  for (let i = 0; i < size; i++) {
    const key = keys[i];
    const val = values[i];
    const check = Number(key);
    // Test if key is a valid number or JS identifier
    // so that we don't have to serialize the key and wrap with brackets
    const isIdentifier = check >= 0 || IDENTIFIER_CHECK.test(key);
    const validKey = isIdentifier ? key : quote(key);
    if (isReferenceInStack(ctx, val)) {
      const refParam = getRefParam(ctx, val[1]);
      createObjectAssign(
        ctx,
        sourceID,
        validKey,
        refParam,
        !(isIdentifier && Number.isNaN(check)),
      );
    } else {
      result += `${validKey}:${serializeTree(ctx, val)},`;
    }
  }
  ctx.stack.pop();
  return `{${result.substring(0, result.length - 1)}}`;
}

export function serializeTree(
  ctx: SerializationContext,
  [type, value, id]: SerovalNode,
): string {
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
      let values = '';
      for (let i = 0, len = value[1].length; i < len; i++) {
        values += `${serializePrimitive(ctx, value[1][i])},`;
      }
      let args = values ? `[${values.substring(0, values.length - 1)}]` : '[]';
      if (value[1].byteOffset !== 0) {
        args += `,${value[1].byteOffset}`;
      }
      return assignRef(ctx, id, `new ${value[0]}(${args})`);
    }
    case SerovalNodeType.Set: {
      let serialized = 'new Set';
      const size = value.length;
      if (size) {
        let result = '';
        ctx.stack.push(id);
        for (let i = 0; i < size; i++) {
          const item = value[i];
          if (isReferenceInStack(ctx, item)) {
            createSetAdd(ctx, id, getRefParam(ctx, item[1]));
          } else {
            // Push directly
            result += `${serializeTree(ctx, item)},`;
          }
        }
        ctx.stack.pop();
        if (result) {
          serialized += `([${result.substring(0, result.length - 1)}])`;
        }
      }
      return assignRef(ctx, id, serialized);
    }
    case SerovalNodeType.Map: {
      let serialized = 'new Map';
      const size = value[2];
      if (size) {
        let result = '';
        ctx.stack.push(id);
        for (let i = 0; i < size; i++) {
          // Check if key is a parent
          const key = value[0][i];
          const val = value[1][i];
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
            result += `[${serializeTree(ctx, key)},${serializeTree(ctx, val)}],`;
          }
        }
        ctx.stack.pop();
        // Check if there are any values
        // so that the empty Map constructor
        // can be used instead
        if (result) {
          serialized += `([${result.substring(0, result.length - 1)}])`;
        }
      }
      return assignRef(ctx, id, serialized);
    }
    case SerovalNodeType.Array: {
      // This is different than Map and Set
      // because we also need to serialize
      // the holes of the Array
      const size = value.length;
      let values = '';
      ctx.stack.push(id);
      for (let i = 0; i < size; i++) {
        const item = value[i];
        // Check if index is a hole
        if (i in value) {
          // Check if item is a parent
          if (isReferenceInStack(ctx, item)) {
            createArrayAssign(ctx, id, i, getRefParam(ctx, item[1]));
            values += ',';
          } else {
            values += serializeTree(ctx, item);
            if (i < size - 1) {
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
      let serialized = `new AggregateError(${serializeTree(ctx, value[2])},${quote(value[0])})`;
      ctx.stack.pop();
      // `AggregateError` might've been extended
      // either through class or custom properties
      // Make sure to assign extra properties
      if (value[1]) {
        if (ctx.features.has(Feature.ObjectAssign)) {
          const options = serializeObject(ctx, id, value[1]);
          serialized = `Object.assign(${serialized},${options})`;
        } else {
          markRef(ctx, id);
          const assignments = serializeAssignments(ctx, id, value[1]);
          if (assignments) {
            const ref = getRefParam(ctx, id);
            return `(${assignRef(ctx, id, serialized)},${assignments}${ref})`;
          }
        }
      }
      return assignRef(ctx, id, serialized);
    }
    case SerovalNodeType.Error: {
      let serialized = `new ${value[0]}(${quote(value[1])})`;
      if (value[2]) {
        if (ctx.features.has(Feature.ObjectAssign)) {
          const options = serializeObject(ctx, id, value[2]);
          serialized = `Object.assign(${serialized},${options})`;
        } else {
          markRef(ctx, id);
          const assignments = serializeAssignments(ctx, id, value[2]);
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
      const values = serializeTree(ctx, value[1]);
      ctx.stack = parent;
      let serialized: string;
      if (ctx.features.has(Feature.ArrayPrototypeValues)) {
        serialized = `${values}.values()`;
      } else {
        serialized = `${values}[Symbol.iterator]()`;
      }
      if (ctx.features.has(Feature.ArrowFunction)) {
        serialized = `{[Symbol.iterator]:()=>${serialized}}`;
      } else if (ctx.features.has(Feature.MethodShorthand)) {
        serialized = `{[Symbol.iterator](){return ${serialized}}}`;
      } else {
        serialized = `{[Symbol.iterator]:function(){return ${serialized}}}`;
      }
      if (value[0]) {
        if (ctx.features.has(Feature.ObjectAssign)) {
          const options = serializeObject(ctx, id, value[0]);
          serialized = `Object.assign(${serialized},${options})`;
        } else {
          markRef(ctx, id);
          const assignments = serializeAssignments(ctx, id, value[0]);
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
      if (ctx.features.has(Feature.ObjectAssign)) {
        const fields = serializeObject(ctx, id, value);
        if (fields !== '{}') {
          serialized = `Object.assign(${serialized},${fields})`;
        }
      } else {
        markRef(ctx, id);
        const assignments = serializeAssignments(ctx, id, value);
        if (assignments) {
          const ref = getRefParam(ctx, id);
          return `(${assignRef(ctx, id, serialized)},${assignments}${ref})`;
        }
      }
      return assignRef(ctx, id, serialized);
    }
    case SerovalNodeType.Object:
      return assignRef(ctx, id, serializeObject(ctx, id, value));
    default:
      throw new Error('Unsupported type');
  }
}
