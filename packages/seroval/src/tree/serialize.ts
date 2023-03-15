/* eslint-disable @typescript-eslint/no-use-before-define */
import { Feature } from '../compat';
import {
  SerializationContext,
  Assignment,
  getRefParam,
  markRef,
} from '../context';
import quote from '../quote';
import { isReferenceInStack } from './shared';
import { SerovalDictionaryNode, SerovalNode, SerovalNodeType } from './types';

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
 * Generates the inlined assignment for the reference
 * This is different from the assignments array as this one
 * signifies creation rather than mutation
 */
function assignRef(
  ctx: SerializationContext,
  index: number,
  value: string,
) {
  if (ctx.markedRefs.has(index)) {
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
  if (size === 0) {
    return '{}';
  }
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

function serializePromise(
  ctx: SerializationContext,
  value: SerovalNode,
  id: number,
) {
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

function serializeTypedArray(
  ctx: SerializationContext,
  constructor: string,
  init: string,
  byteOffset: number,
  id: number,
) {
  let args = `[${init}]`;
  if (byteOffset !== 0) {
    args += `,${byteOffset}`;
  }
  return assignRef(ctx, id, `new ${constructor}(${args})`);
}

function serializeSet(
  ctx: SerializationContext,
  value: SerovalNode[],
  id: number,
) {
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

function serializeMap(
  ctx: SerializationContext,
  keys: SerovalNode[],
  values: SerovalNode[],
  size: number,
  id: number,
) {
  let serialized = 'new Map';
  if (size) {
    let result = '';
    ctx.stack.push(id);
    for (let i = 0; i < size; i++) {
      // Check if key is a parent
      const key = keys[i];
      const val = values[i];
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

function serializeNodeList(
  ctx: SerializationContext,
  value: SerovalNode[],
  id: number,
) {
  // This is different than Map and Set
  // because we also need to serialize
  // the holes of the Array
  const size = value.length;
  let values = '';
  for (let i = 0; i < size; i++) {
    const item = value[i];
    // Check if index is a hole
    if (item) {
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
  return `[${values}]`;
}

function serializeArray(
  ctx: SerializationContext,
  value: SerovalNode[],
  id: number,
) {
  ctx.stack.push(id);
  const result = serializeNodeList(ctx, value, id);
  ctx.stack.pop();
  return assignRef(ctx, id, result);
}

function serializeWithObjectAssign(
  ctx: SerializationContext,
  value: SerovalDictionaryNode,
  id: number,
  serialized: string,
) {
  const fields = serializeObject(ctx, id, value);
  if (fields !== '{}') {
    return `Object.assign(${serialized},${fields})`;
  }
  return serialized;
}

function serializeAggregateError(
  ctx: SerializationContext,
  message: string,
  options: SerovalDictionaryNode | undefined,
  errors: SerovalNode,
  id: number,
) {
  // Serialize the required arguments
  ctx.stack.push(id);
  let serialized = `new AggregateError(${serializeTree(ctx, errors)},${quote(message)})`;
  ctx.stack.pop();
  // `AggregateError` might've been extended
  // either through class or custom properties
  // Make sure to assign extra properties
  if (options) {
    if (ctx.features & Feature.ObjectAssign) {
      serialized = serializeWithObjectAssign(ctx, options, id, serialized);
    } else {
      markRef(ctx, id);
      const assignments = serializeAssignments(ctx, id, options);
      if (assignments) {
        const ref = getRefParam(ctx, id);
        return `(${assignRef(ctx, id, serialized)},${assignments}${ref})`;
      }
    }
  }
  return assignRef(ctx, id, serialized);
}

function serializeError(
  ctx: SerializationContext,
  constructor: string,
  message: string,
  options: SerovalDictionaryNode | undefined,
  id: number,
) {
  let serialized = `new ${constructor}(${quote(message)})`;
  if (options) {
    if (ctx.features & Feature.ObjectAssign) {
      serialized = serializeWithObjectAssign(ctx, options, id, serialized);
    } else {
      markRef(ctx, id);
      const assignments = serializeAssignments(ctx, id, options);
      if (assignments) {
        const ref = getRefParam(ctx, id);
        return `(${assignRef(ctx, id, serialized)},${assignments}${ref})`;
      }
    }
  }
  return assignRef(ctx, id, serialized);
}

function serializeIterable(
  ctx: SerializationContext,
  options: SerovalDictionaryNode | undefined,
  items: SerovalNode[],
  id: number,
) {
  const parent = ctx.stack;
  ctx.stack = [];
  const values = serializeNodeList(ctx, items, id);
  ctx.stack = parent;
  let serialized: string;
  if (ctx.features & Feature.ArrayPrototypeValues) {
    serialized = `${values}.values()`;
  } else {
    serialized = `${values}[Symbol.iterator]()`;
  }
  if (ctx.features & Feature.ArrowFunction) {
    serialized = `{[Symbol.iterator]:()=>${serialized}}`;
  } else if (ctx.features & Feature.MethodShorthand) {
    serialized = `{[Symbol.iterator](){return ${serialized}}}`;
  } else {
    serialized = `{[Symbol.iterator]:function(){return ${serialized}}}`;
  }
  if (options) {
    if (ctx.features & Feature.ObjectAssign) {
      serialized = serializeWithObjectAssign(ctx, options, id, serialized);
    } else {
      markRef(ctx, id);
      const assignments = serializeAssignments(ctx, id, options);
      if (assignments) {
        const ref = getRefParam(ctx, id);
        return `(${assignRef(ctx, id, serialized)},${assignments}${ref})`;
      }
    }
  }
  return assignRef(ctx, id, serialized);
}

function serializeNullConstructor(
  ctx: SerializationContext,
  value: SerovalDictionaryNode,
  id: number,
) {
  let serialized = 'Object.create(null)';
  if (ctx.features & Feature.ObjectAssign) {
    serialized = serializeWithObjectAssign(ctx, value, id, serialized);
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

export default function serializeTree(
  ctx: SerializationContext,
  [type, value, id]: SerovalNode,
): string {
  switch (type) {
    case SerovalNodeType.Primitive:
      return String(value);
    case SerovalNodeType.Reference:
      return getRefParam(ctx, value);
    case SerovalNodeType.Promise:
      return serializePromise(ctx, value, id);
    case SerovalNodeType.BigInt:
      return value;
    case SerovalNodeType.Date:
      return assignRef(ctx, id, `new Date("${value}")`);
    case SerovalNodeType.RegExp:
      return assignRef(ctx, id, value);
    case SerovalNodeType.BigIntTypedArray:
    case SerovalNodeType.TypedArray:
      return serializeTypedArray(ctx, value[0], value[1], value[2], id);
    case SerovalNodeType.Set:
      return serializeSet(ctx, value, id);
    case SerovalNodeType.Map:
      return serializeMap(ctx, value[0], value[1], value[2], id);
    case SerovalNodeType.Array:
      return serializeArray(ctx, value, id);
    case SerovalNodeType.AggregateError:
      return serializeAggregateError(ctx, value[0], value[1], value[2], id);
    case SerovalNodeType.Error:
      return serializeError(ctx, value[0], value[1], value[2], id);
    case SerovalNodeType.Iterable:
      return serializeIterable(ctx, value[0], value[1], id);
    case SerovalNodeType.NullConstructor:
      return serializeNullConstructor(ctx, value, id);
    case SerovalNodeType.Object:
      return assignRef(ctx, id, serializeObject(ctx, id, value));
    default:
      throw new Error('Unsupported type');
  }
}
