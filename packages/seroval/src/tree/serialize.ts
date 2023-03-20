/* eslint-disable @typescript-eslint/no-use-before-define */
import { Feature } from '../compat';
import {
  SerializationContext,
  Assignment,
  getRefParam,
  markRef,
} from '../context';
import quote from '../quote';
import { isValidIdentifier } from './shared';
import { SYMBOL_STRING } from './symbols';
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
  SerovalObjectNode,
  SerovalObjectRecordNode,
  SerovalPromiseNode,
  SerovalReferenceNode,
  SerovalSetNode,
  SerovalTypedArrayNode,
} from './types';

function getAssignmentExpression(assignment: Assignment): string {
  switch (assignment.t) {
    case 'index':
      return assignment.s + '=' + assignment.v;
    case 'map':
      return assignment.s + '.set(' + assignment.k + ',' + assignment.v + ')';
    case 'set':
      return assignment.s + '.add(' + assignment.v + ')';
    default:
      return '';
  }
}

function mergeAssignments(assignments: Assignment[]) {
  const newAssignments = [];
  let current = assignments[0];
  let prev = current;
  let item: Assignment;
  for (let i = 1, len = assignments.length; i < len; i++) {
    item = assignments[i];
    if (item.t === prev.t) {
      switch (item.t) {
        case 'index':
          if (item.v === prev.v) {
            // Merge if the right-hand value is the same
            // saves at least 2 chars
            current = {
              t: 'index',
              s: item.s,
              k: undefined,
              v: getAssignmentExpression(current),
            };
          } else {
            // Different assignment, push current
            newAssignments.push(current);
            current = item;
          }
          break;
        case 'map':
          if (item.s === prev.s) {
            // Maps has chaining methods, merge if source is the same
            current = {
              t: 'map',
              s: getAssignmentExpression(current),
              k: item.k,
              v: item.v,
            };
          } else {
            // Different assignment, push current
            newAssignments.push(current);
            current = item;
          }
          break;
        case 'set':
          if (item.s === prev.s) {
            // Sets has chaining methods too
            current = {
              t: 'set',
              s: getAssignmentExpression(current),
              k: undefined,
              v: item.v,
            };
          } else {
            // Different assignment, push current
            newAssignments.push(current);
            current = item;
          }
          break;
        default:
          break;
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
      result += getAssignmentExpression(merged[i]) + ',';
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

function createAssignment(
  ctx: SerializationContext,
  source: string,
  value: string,
) {
  ctx.assignments.push({
    t: 'index',
    s: source,
    k: undefined,
    v: value,
  });
}

function createSetAdd(
  ctx: SerializationContext,
  ref: number,
  value: string,
) {
  markRef(ctx, ref);
  ctx.assignments.push({
    t: 'set',
    s: getRefParam(ctx, ref),
    k: undefined,
    v: value,
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
    t: 'map',
    s: getRefParam(ctx, ref),
    k: key,
    v: value,
  });
}

function createArrayAssign(
  ctx: SerializationContext,
  ref: number,
  index: number | string,
  value: string,
) {
  markRef(ctx, ref);
  createAssignment(ctx, getRefParam(ctx, ref) + '[' + index + ']', value);
}

function createObjectAssign(
  ctx: SerializationContext,
  ref: number,
  key: string,
  value: string,
) {
  markRef(ctx, ref);
  createAssignment(ctx, getRefParam(ctx, ref) + '.' + key, value);
}

function assignRef(
  ctx: SerializationContext,
  index: number,
  value: string,
) {
  if (ctx.markedRefs.has(index)) {
    return getRefParam(ctx, index) + '=' + value;
  }
  return value;
}

function isReferenceInStack(
  ctx: SerializationContext,
  node: SerovalNode,
): node is SerovalReferenceNode {
  return node.t === SerovalNodeType.Reference && ctx.stack.includes(node.i);
}

function serializeNodeList(
  ctx: SerializationContext,
  node: SerovalArrayNode | SerovalIterableNode | SerovalAggregateErrorNode,
) {
  // This is different than Map and Set
  // because we also need to serialize
  // the holes of the Array
  const size = node.l;
  let values = '';
  let item: SerovalNode;
  let isHoley = false;
  for (let i = 0; i < size; i++) {
    if (i !== 0) {
      // Add an empty item
      values += ',';
    }
    item = node.a[i];
    // Check if index is a hole
    if (item) {
      // Check if item is a parent
      if (isReferenceInStack(ctx, item)) {
        createArrayAssign(ctx, node.i, i, getRefParam(ctx, item.i));
        isHoley = true;
      } else {
        values += serializeTree(ctx, item);
        isHoley = false;
      }
    } else {
      isHoley = true;
    }
  }
  return '[' + values + (isHoley ? ',]' : ']');
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

function serializeProperties(
  ctx: SerializationContext,
  sourceID: number,
  node: SerovalObjectRecordNode,
) {
  if (node.s === 0) {
    return '{}';
  }
  let result = '';
  ctx.stack.push(sourceID);
  let key: string;
  let val: SerovalNode;
  let check: number;
  let isIdentifier: boolean;
  let refParam: string;
  let hasPrev = false;
  for (let i = 0; i < node.s; i++) {
    key = node.k[i];
    val = node.v[i];
    check = Number(key);
    // Test if key is a valid number or JS identifier
    // so that we don't have to serialize the key and wrap with brackets
    isIdentifier = check >= 0 || isValidIdentifier(key);
    if (isReferenceInStack(ctx, val)) {
      refParam = getRefParam(ctx, val.i);
      if (isIdentifier && Number.isNaN(check)) {
        createObjectAssign(ctx, sourceID, key, refParam);
      } else {
        createArrayAssign(ctx, sourceID, isIdentifier ? key : ('"' + quote(key) + '"'), refParam);
      }
    } else {
      result += (hasPrev ? ',' : '')
        + (isIdentifier ? key : ('"' + quote(key) + '"'))
        + ':' + serializeTree(ctx, val);
      hasPrev = true;
    }
  }
  ctx.stack.pop();
  return '{' + result + '}';
}

function serializeWithObjectAssign(
  ctx: SerializationContext,
  value: SerovalObjectRecordNode,
  id: number,
  serialized: string,
) {
  const fields = serializeProperties(ctx, id, value);
  if (fields !== '{}') {
    return 'Object.assign(' + serialized + ',' + fields + ')';
  }
  return serialized;
}

function serializeAssignments(
  ctx: SerializationContext,
  sourceID: number,
  node: SerovalObjectRecordNode,
) {
  ctx.stack.push(sourceID);
  const mainAssignments: Assignment[] = [];
  let parentStack: number[];
  let refParam: string;
  let key: string;
  let check: number;
  let parentAssignment: Assignment[];
  let isIdentifier: boolean;
  for (let i = 0; i < node.s; i++) {
    parentStack = ctx.stack;
    ctx.stack = [];
    refParam = serializeTree(ctx, node.v[i]);
    ctx.stack = parentStack;
    key = node.k[i];
    check = Number(key);
    parentAssignment = ctx.assignments;
    ctx.assignments = mainAssignments;
    // Test if key is a valid number or JS identifier
    // so that we don't have to serialize the key and wrap with brackets
    isIdentifier = check >= 0 || isValidIdentifier(key);
    if (isIdentifier && Number.isNaN(check)) {
      createObjectAssign(ctx, sourceID, key, refParam);
    } else {
      createArrayAssign(ctx, sourceID, isIdentifier ? key : ('"' + quote(key) + '"'), refParam);
    }
    ctx.assignments = parentAssignment;
  }
  ctx.stack.pop();
  return resolveAssignments(mainAssignments);
}

function serializeDictionary(
  ctx: SerializationContext,
  i: number,
  d: SerovalObjectRecordNode | undefined,
  init: string,
) {
  if (d) {
    if (ctx.features & Feature.ObjectAssign) {
      init = serializeWithObjectAssign(ctx, d, i, init);
    } else {
      markRef(ctx, i);
      const assignments = serializeAssignments(ctx, i, d);
      if (assignments) {
        return '(' + assignRef(ctx, i, init) + ',' + assignments + getRefParam(ctx, i) + ')';
      }
    }
  }
  return assignRef(ctx, i, init);
}

function serializeNullConstructor(
  ctx: SerializationContext,
  node: SerovalNullConstructorNode,
) {
  return serializeDictionary(ctx, node.i, node.d, 'Object.create(null)');
}

function serializeObject(
  ctx: SerializationContext,
  node: SerovalObjectNode,
) {
  return assignRef(ctx, node.i, serializeProperties(ctx, node.i, node.d));
}

function serializeSet(
  ctx: SerializationContext,
  node: SerovalSetNode,
) {
  let serialized = 'new Set';
  const size = node.l;
  if (size) {
    let result = '';
    ctx.stack.push(node.i);
    let item: SerovalNode;
    let hasPrev = false;
    for (let i = 0; i < size; i++) {
      item = node.a[i];
      if (isReferenceInStack(ctx, item)) {
        createSetAdd(ctx, node.i, getRefParam(ctx, item.i));
      } else {
        // Push directly
        result += (hasPrev ? ',' : '') + serializeTree(ctx, item);
        hasPrev = true;
      }
    }
    ctx.stack.pop();
    if (result) {
      serialized += '([' + result + '])';
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
    let key: SerovalNode;
    let val: SerovalNode;
    let keyRef: string;
    let valueRef: string;
    let parent: number[];
    let hasPrev = false;
    for (let i = 0; i < node.d.s; i++) {
      // Check if key is a parent
      key = node.d.k[i];
      val = node.d.v[i];
      if (isReferenceInStack(ctx, key)) {
        // Create reference for the map instance
        keyRef = getRefParam(ctx, key.i);
        // Check if value is a parent
        if (isReferenceInStack(ctx, val)) {
          valueRef = getRefParam(ctx, val.i);
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
          parent = ctx.stack;
          ctx.stack = [];
          createMapSet(ctx, node.i, keyRef, serializeTree(ctx, val));
          ctx.stack = parent;
        }
      } else if (isReferenceInStack(ctx, val)) {
        // Create ref for the Map instance
        valueRef = getRefParam(ctx, val.i);
        // Reset stack for the key serialization
        parent = ctx.stack;
        ctx.stack = [];
        createMapSet(ctx, node.i, serializeTree(ctx, key), valueRef);
        ctx.stack = parent;
      } else {
        result += (hasPrev ? ',[' : '[') + serializeTree(ctx, key) + ',' + serializeTree(ctx, val) + ']';
        hasPrev = true;
      }
    }
    ctx.stack.pop();
    // Check if there are any values
    // so that the empty Map constructor
    // can be used instead
    if (result) {
      serialized += '([' + result + '])';
    }
  }
  return assignRef(ctx, node.i, serialized);
}

function serializeAggregateError(
  ctx: SerializationContext,
  node: SerovalAggregateErrorNode,
) {
  // Serialize the required arguments
  ctx.stack.push(node.i);
  const serialized = 'new AggregateError(' + serializeNodeList(ctx, node) + ',"' + quote(node.m) + '")';
  ctx.stack.pop();
  // `AggregateError` might've been extended
  // either through class or custom properties
  // Make sure to assign extra properties
  return serializeDictionary(ctx, node.i, node.d, serialized);
}

function serializeError(
  ctx: SerializationContext,
  node: SerovalErrorNode,
) {
  const serialized = 'new ' + node.c + '("' + quote(node.m) + '")';
  return serializeDictionary(ctx, node.i, node.d, serialized);
}

function serializePromise(
  ctx: SerializationContext,
  node: SerovalPromiseNode,
) {
  let serialized: string;
  // Check if resolved value is a parent expression
  if (isReferenceInStack(ctx, node.f)) {
    // A Promise trick, reference the value
    // inside the `then` expression so that
    // the Promise evaluates after the parent
    // has initialized
    const ref = getRefParam(ctx, node.f.i);
    if (ctx.features & Feature.ArrowFunction) {
      serialized = 'Promise.resolve().then(()=>' + ref + ')';
    } else {
      serialized = 'Promise.resolve().then(function(){return ' + ref + '})';
    }
  } else {
    ctx.stack.push(node.i);
    const result = serializeTree(ctx, node.f);
    ctx.stack.pop();
    // just inline the value/reference here
    serialized = 'Promise.resolve(' + result + ')';
  }
  return assignRef(ctx, node.i, serialized);
}

function serializeTypedArray(
  ctx: SerializationContext,
  node: SerovalTypedArrayNode | SerovalBigIntTypedArrayNode,
) {
  let result = '';
  const isBigInt = node.t === SerovalNodeType.BigIntTypedArray;
  for (let i = 0, len = node.s.length; i < len; i++) {
    result += (i !== 0 ? ',' : '') + node.s[i] + (isBigInt ? 'n' : '');
  }
  const args = '[' + result + ']' + (node.l !== 0 ? (',' + node.l) : '');
  return assignRef(ctx, node.i, 'new ' + node.c + '(' + args + ')');
}

function serializeIterable(
  ctx: SerializationContext,
  node: SerovalIterableNode,
) {
  const parent = ctx.stack;
  ctx.stack = [];
  const values = serializeNodeList(ctx, node);
  ctx.stack = parent;
  let serialized = values;
  if (ctx.features & Feature.ArrayPrototypeValues) {
    serialized += '.values()';
  } else {
    serialized += '[Symbol.iterator]()';
  }
  if (ctx.features & Feature.ArrowFunction) {
    serialized = '{[Symbol.iterator]:()=>' + serialized + '}';
  } else if (ctx.features & Feature.MethodShorthand) {
    serialized = '{[Symbol.iterator](){return ' + serialized + '}}';
  } else {
    serialized = '{[Symbol.iterator]:function(){return ' + serialized + '}}';
  }
  return serializeDictionary(ctx, node.i, node.d, serialized);
}

export default function serializeTree(
  ctx: SerializationContext,
  node: SerovalNode,
): string {
  switch (node.t) {
    case SerovalNodeType.Number:
      return '' + node.s;
    case SerovalNodeType.String:
      return '"' + node.s + '"';
    case SerovalNodeType.Boolean:
      return node.s ? '!0' : '!1';
    case SerovalNodeType.Undefined:
      return 'void 0';
    case SerovalNodeType.Null:
      return 'null';
    case SerovalNodeType.NegativeZero:
      return '-0';
    case SerovalNodeType.Infinity:
      return '1/0';
    case SerovalNodeType.NegativeInfinity:
      return '-1/0';
    case SerovalNodeType.NaN:
      return 'NaN';
    case SerovalNodeType.BigInt:
      return node.s + 'n';
    case SerovalNodeType.Reference:
      return getRefParam(ctx, node.i);
    case SerovalNodeType.Array:
      return serializeArray(ctx, node);
    case SerovalNodeType.Object:
      return serializeObject(ctx, node);
    case SerovalNodeType.NullConstructor:
      return serializeNullConstructor(ctx, node);
    case SerovalNodeType.Date:
      return assignRef(ctx, node.i, 'new Date("' + node.s + '")');
    case SerovalNodeType.RegExp:
      return assignRef(ctx, node.i, '/' + node.c + '/' + node.m);
    case SerovalNodeType.Set:
      return serializeSet(ctx, node);
    case SerovalNodeType.Map:
      return serializeMap(ctx, node);
    case SerovalNodeType.BigIntTypedArray:
    case SerovalNodeType.TypedArray:
      return serializeTypedArray(ctx, node);
    case SerovalNodeType.AggregateError:
      return serializeAggregateError(ctx, node);
    case SerovalNodeType.Error:
      return serializeError(ctx, node);
    case SerovalNodeType.Iterable:
      return serializeIterable(ctx, node);
    case SerovalNodeType.Promise:
      return serializePromise(ctx, node);
    case SerovalNodeType.WKSymbol:
      return SYMBOL_STRING[node.s];
    default:
      throw new Error('Unsupported type');
  }
}
