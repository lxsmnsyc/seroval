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
import {
  SerovalAggregateErrorNode,
  SerovalArrayNode,
  SerovalBigIntTypedArrayNode,
  SerovalErrorNode,
  SerovalIterableNode,
  SerovalMapNode,
  SerovalNode,
  SerovalNodeType,
  SerovalNullConstructorNode,
  SerovalObjectRecordNode,
  SerovalPromiseNode,
  SerovalSetNode,
  SerovalTypedArrayNode,
} from './types';

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
  index: number | string,
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
) {
  markRef(ctx, ref);
  createAssignment(ctx, `${getRefParam(ctx, ref)}.${key}`, value);
}

const IDENTIFIER_CHECK = /^([$A-Z_][0-9A-Z_$]*)$/i;

function serializeAssignments(
  ctx: SerializationContext,
  targetRef: number,
  node: SerovalObjectRecordNode,
) {
  ctx.stack.push(targetRef);
  const mainAssignments: Assignment[] = [];
  for (let i = 0; i < node.s; i++) {
    const parentStack = ctx.stack;
    ctx.stack = [];
    const refParam = serializeTree(ctx, node.v[i]);
    ctx.stack = parentStack;
    const key = node.k[i];
    const check = Number(key);
    const parentAssignment = ctx.assignments;
    ctx.assignments = mainAssignments;
    // Test if key is a valid number or JS identifier
    // so that we don't have to serialize the key and wrap with brackets
    const isIdentifier = check >= 0 || IDENTIFIER_CHECK.test(key);
    if (isIdentifier && Number.isNaN(check)) {
      createObjectAssign(ctx, targetRef, key, refParam);
    } else {
      createArrayAssign(ctx, targetRef, isIdentifier ? key : quote(key), refParam);
    }
    ctx.assignments = parentAssignment;
  }
  ctx.stack.pop();
  return resolveAssignments(mainAssignments);
}

function serializeObject(
  ctx: SerializationContext,
  sourceID: number,
  node: SerovalObjectRecordNode,
) {
  if (node.s === 0) {
    return '{}';
  }
  let result = '';
  ctx.stack.push(sourceID);
  for (let i = 0; i < node.s; i++) {
    const key = node.k[i];
    const val = node.v[i];
    const check = Number(key);
    // Test if key is a valid number or JS identifier
    // so that we don't have to serialize the key and wrap with brackets
    const isIdentifier = check >= 0 || IDENTIFIER_CHECK.test(key);
    if (isReferenceInStack(ctx, val)) {
      const refParam = getRefParam(ctx, val.i);
      if (isIdentifier && Number.isNaN(check)) {
        createObjectAssign(ctx, sourceID, key, refParam);
      } else {
        createArrayAssign(ctx, sourceID, isIdentifier ? key : quote(key), refParam);
      }
    } else {
      result += `${isIdentifier ? key : quote(key)}:${serializeTree(ctx, val)},`;
    }
  }
  ctx.stack.pop();
  return `{${result.substring(0, result.length - 1)}}`;
}

function serializePromise(
  ctx: SerializationContext,
  node: SerovalPromiseNode,
) {
  let serialized: string;
  // Check if resolved value is a parent expression
  if (isReferenceInStack(ctx, node.n)) {
    // A Promise trick, reference the value
    // inside the `then` expression so that
    // the Promise evaluates after the parent
    // has initialized
    serialized = `Promise.resolve().then(()=>${getRefParam(ctx, node.n.i)})`;
  } else {
    ctx.stack.push(node.i);
    const result = serializeTree(ctx, node.n);
    ctx.stack.pop();
    // just inline the value/reference here
    serialized = `Promise.resolve(${result})`;
  }
  return assignRef(ctx, node.i, serialized);
}

function serializeTypedArray(
  ctx: SerializationContext,
  node: SerovalTypedArrayNode | SerovalBigIntTypedArrayNode,
) {
  let args = `[${node.s}]`;
  if (node.l !== 0) {
    args += `,${node.l}`;
  }
  return assignRef(ctx, node.i, `new ${node.c}(${args})`);
}

function serializeSet(
  ctx: SerializationContext,
  node: SerovalSetNode,
) {
  let serialized = 'new Set';
  const size = node.a.length;
  if (size) {
    let result = '';
    ctx.stack.push(node.i);
    for (let i = 0; i < size; i++) {
      const item = node.a[i];
      if (isReferenceInStack(ctx, item)) {
        createSetAdd(ctx, node.i, getRefParam(ctx, item.i));
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
  return assignRef(ctx, node.i, serialized);
}

function serializeMap(
  ctx: SerializationContext,
  node: SerovalMapNode,
) {
  let serialized = 'new Map';
  if (node.d.s) {
    let result = '';
    ctx.stack.push(node.i);
    for (let i = 0; i < node.d.s; i++) {
      // Check if key is a parent
      const key = node.d.k[i];
      const val = node.d.v[i];
      if (isReferenceInStack(ctx, key)) {
        // Create reference for the map instance
        const keyRef = getRefParam(ctx, key.i);
        // Check if value is a parent
        if (isReferenceInStack(ctx, val)) {
          const valueRef = getRefParam(ctx, val.i);
          // Register an assignment since
          // both key and value are a parent of this
          // Map instance
          createMapSet(ctx, node.i, keyRef, valueRef);
        } else {
          // Reset the stack
          // This is required because the serialized
          // value is no longer part of the expression
          // tree and has been moved to the deferred
          // assignment
          const parent = ctx.stack;
          ctx.stack = [];
          createMapSet(ctx, node.i, keyRef, serializeTree(ctx, val));
          ctx.stack = parent;
        }
      } else if (isReferenceInStack(ctx, val)) {
        // Create ref for the Map instance
        const valueRef = getRefParam(ctx, val.i);
        // Reset stack for the key serialization
        const parent = ctx.stack;
        ctx.stack = [];
        createMapSet(ctx, node.i, serializeTree(ctx, key), valueRef);
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
  return assignRef(ctx, node.i, serialized);
}

function serializeNodeList(
  ctx: SerializationContext,
  node: SerovalArrayNode | SerovalIterableNode,
) {
  // This is different than Map and Set
  // because we also need to serialize
  // the holes of the Array
  const size = node.a.length;
  let values = '';
  for (let i = 0; i < size; i++) {
    const item = node.a[i];
    // Check if index is a hole
    if (item) {
      // Check if item is a parent
      if (isReferenceInStack(ctx, item)) {
        createArrayAssign(ctx, node.i, i, getRefParam(ctx, item.i));
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
  node: SerovalArrayNode,
) {
  ctx.stack.push(node.i);
  const result = serializeNodeList(ctx, node);
  ctx.stack.pop();
  return assignRef(ctx, node.i, result);
}

function serializeWithObjectAssign(
  ctx: SerializationContext,
  value: SerovalObjectRecordNode,
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
  node: SerovalAggregateErrorNode,
) {
  // Serialize the required arguments
  ctx.stack.push(node.i);
  let serialized = `new AggregateError(${serializeTree(ctx, node.n)},${quote(node.m)})`;
  ctx.stack.pop();
  // `AggregateError` might've been extended
  // either through class or custom properties
  // Make sure to assign extra properties
  if (node.d) {
    if (ctx.features & Feature.ObjectAssign) {
      serialized = serializeWithObjectAssign(ctx, node.d, node.i, serialized);
    } else {
      markRef(ctx, node.i);
      const assignments = serializeAssignments(ctx, node.i, node.d);
      if (assignments) {
        const ref = getRefParam(ctx, node.i);
        return `(${assignRef(ctx, node.i, serialized)},${assignments}${ref})`;
      }
    }
  }
  return assignRef(ctx, node.i, serialized);
}

function serializeError(
  ctx: SerializationContext,
  node: SerovalErrorNode,
) {
  let serialized = `new ${node.c}(${quote(node.m)})`;
  if (node.d) {
    if (ctx.features & Feature.ObjectAssign) {
      serialized = serializeWithObjectAssign(ctx, node.d, node.i, serialized);
    } else {
      markRef(ctx, node.i);
      const assignments = serializeAssignments(ctx, node.i, node.d);
      if (assignments) {
        const ref = getRefParam(ctx, node.i);
        return `(${assignRef(ctx, node.i, serialized)},${assignments}${ref})`;
      }
    }
  }
  return assignRef(ctx, node.i, serialized);
}

function serializeIterable(
  ctx: SerializationContext,
  node: SerovalIterableNode,
) {
  const parent = ctx.stack;
  ctx.stack = [];
  const values = serializeNodeList(ctx, node);
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
  if (node.d) {
    if (ctx.features & Feature.ObjectAssign) {
      serialized = serializeWithObjectAssign(ctx, node.d, node.i, serialized);
    } else {
      markRef(ctx, node.i);
      const assignments = serializeAssignments(ctx, node.i, node.d);
      if (assignments) {
        const ref = getRefParam(ctx, node.i);
        return `(${assignRef(ctx, node.i, serialized)},${assignments}${ref})`;
      }
    }
  }
  return assignRef(ctx, node.i, serialized);
}

function serializeNullConstructor(
  ctx: SerializationContext,
  node: SerovalNullConstructorNode,
) {
  let serialized = 'Object.create(null)';
  if (ctx.features & Feature.ObjectAssign) {
    serialized = serializeWithObjectAssign(ctx, node.d, node.i, serialized);
  } else {
    markRef(ctx, node.i);
    const assignments = serializeAssignments(ctx, node.i, node.d);
    if (assignments) {
      const ref = getRefParam(ctx, node.i);
      return `(${assignRef(ctx, node.i, serialized)},${assignments}${ref})`;
    }
  }
  return assignRef(ctx, node.i, serialized);
}

export default function serializeTree(
  ctx: SerializationContext,
  node: SerovalNode,
): string {
  switch (node.t) {
    case SerovalNodeType.Primitive:
      return String(node.s);
    case SerovalNodeType.Reference:
      return getRefParam(ctx, node.i);
    case SerovalNodeType.Promise:
      return serializePromise(ctx, node);
    case SerovalNodeType.BigInt:
      return node.s;
    case SerovalNodeType.Date:
      return assignRef(ctx, node.i, `new Date("${node.s}")`);
    case SerovalNodeType.RegExp:
      return assignRef(ctx, node.i, node.s);
    case SerovalNodeType.BigIntTypedArray:
    case SerovalNodeType.TypedArray:
      return serializeTypedArray(ctx, node);
    case SerovalNodeType.Set:
      return serializeSet(ctx, node);
    case SerovalNodeType.Map:
      return serializeMap(ctx, node);
    case SerovalNodeType.Array:
      return serializeArray(ctx, node);
    case SerovalNodeType.AggregateError:
      return serializeAggregateError(ctx, node);
    case SerovalNodeType.Error:
      return serializeError(ctx, node);
    case SerovalNodeType.Iterable:
      return serializeIterable(ctx, node);
    case SerovalNodeType.NullConstructor:
      return serializeNullConstructor(ctx, node);
    case SerovalNodeType.Object:
      return assignRef(ctx, node.i, serializeObject(ctx, node.i, node.d));
    default:
      throw new Error('Unsupported type');
  }
}
