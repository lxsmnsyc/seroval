/* eslint-disable @typescript-eslint/no-use-before-define */
import { Feature } from '../compat';
import type {
  SerializationContext,
  Assignment,
} from './context';
import {
  getRefParam,
  markRef,
} from './context';
import { GLOBAL_KEY } from '../reference';
import { isValidIdentifier } from '../shared';
import type {
  SerovalAggregateErrorNode,
  SerovalArrayNode,
  SerovalBigIntTypedArrayNode,
  SerovalErrorNode,
  SerovalMapNode,
  SerovalNode,
  SerovalNullConstructorNode,
  SerovalObjectNode,
  SerovalPromiseNode,
  SerovalIndexedValueNode,
  SerovalSetNode,
  SerovalTypedArrayNode,
  SerovalArrayBufferNode,
  SerovalDataViewNode,
  SerovalBlobNode,
  SerovalFileNode,
  SerovalHeadersNode,
  SerovalRegExpNode,
  SerovalDateNode,
  SerovalURLNode,
  SerovalURLSearchParamsNode,
  SerovalReferenceNode,
  SerovalFormDataNode,
  SerovalObjectRecordNode,
  SerovalObjectRecordKey,
  SerovalBoxedNode,
  SerovalWKSymbolNode,
} from '../types';
import {
  SerovalObjectRecordSpecialKey,
} from '../types';
import {
  SerovalObjectFlags,
  SerovalNodeType,
  SYMBOL_STRING,
  serializeConstant,
} from '../constants';

function getAssignmentExpression(assignment: Assignment): string {
  switch (assignment.t) {
    case 'index':
      return assignment.s + '=' + assignment.v;
    case 'set':
      return assignment.s + '.set(' + assignment.k + ',' + assignment.v + ')';
    case 'add':
      return assignment.s + '.add(' + assignment.v + ')';
    case 'append':
      return assignment.s + '.append(' + assignment.k + ',' + assignment.v + ')';
    default:
      return '';
  }
}

const OBJECT_FLAG_CONSTRUCTOR: Record<SerovalObjectFlags, string | undefined> = {
  [SerovalObjectFlags.Frozen]: 'Object.freeze',
  [SerovalObjectFlags.Sealed]: 'Object.seal',
  [SerovalObjectFlags.NonExtensible]: 'Object.preventExtensions',
  [SerovalObjectFlags.None]: undefined,
};

function mergeAssignments(assignments: Assignment[]): Assignment[] {
  const newAssignments: Assignment[] = [];
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
        case 'set':
          if (item.s === prev.s) {
            // Maps has chaining methods, merge if source is the same
            current = {
              t: 'set',
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
        case 'add':
          if (item.s === prev.s) {
            // Sets has chaining methods too
            current = {
              t: 'add',
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
        case 'append':
          // Different assignment, push current
          newAssignments.push(current);
          current = item;
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

function resolveAssignments(assignments: Assignment[]): string | undefined {
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

function pushObjectFlag(ctx: SerializationContext, flag: SerovalObjectFlags, id: number): void {
  if (flag !== SerovalObjectFlags.None) {
    markRef(ctx, id);
    ctx.flags.push({
      type: flag,
      value: getRefParam(ctx, id),
    });
  }
}

function resolveFlags(ctx: SerializationContext): string | undefined {
  let result = '';
  for (let i = 0, len = ctx.flags.length; i < len; i++) {
    const flag = ctx.flags[i];
    result += OBJECT_FLAG_CONSTRUCTOR[flag.type] + '(' + flag.value + '),';
  }
  return result;
}

export function resolvePatches(ctx: SerializationContext): string | undefined {
  const assignments = resolveAssignments(ctx.assignments);
  const flags = resolveFlags(ctx);
  if (assignments) {
    if (flags) {
      return assignments + flags;
    }
    return assignments;
  }
  return flags;
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
): void {
  ctx.assignments.push({
    t: 'index',
    s: source,
    k: undefined,
    v: value,
  });
}

function createAddAssignment(
  ctx: SerializationContext,
  ref: number,
  value: string,
): void {
  ctx.assignments.push({
    t: 'add',
    s: getRefParam(ctx, ref),
    k: undefined,
    v: value,
  });
}

function createSetAssignment(
  ctx: SerializationContext,
  ref: number,
  key: string,
  value: string,
): void {
  ctx.assignments.push({
    t: 'set',
    s: getRefParam(ctx, ref),
    k: key,
    v: value,
  });
}

function createAppendAssignment(
  ctx: SerializationContext,
  ref: number,
  key: string,
  value: string,
): void {
  ctx.assignments.push({
    t: 'append',
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
): void {
  createAssignment(ctx, getRefParam(ctx, ref) + '[' + index + ']', value);
}

function createObjectAssign(
  ctx: SerializationContext,
  ref: number,
  key: string,
  value: string,
): void {
  markRef(ctx, ref);
  createAssignment(ctx, getRefParam(ctx, ref) + '.' + key, value);
}

function assignIndexedValue(
  ctx: SerializationContext,
  index: number,
  value: string,
): string {
  if (ctx.reference.marked.has(index)) {
    return getRefParam(ctx, index) + '=' + value;
  }
  return value;
}

function isIndexedValueInStack(
  ctx: SerializationContext,
  node: SerovalNode,
): node is SerovalIndexedValueNode {
  return node.t === SerovalNodeType.IndexedValue && ctx.stack.includes(node.i);
}

function serializeArray(
  ctx: SerializationContext,
  node: SerovalArrayNode,
): string {
  const id = node.i;
  ctx.stack.push(id);
  // This is different than Map and Set
  // because we also need to serialize
  // the holes of the Array
  let values = '';
  let item: SerovalNode | undefined;
  let isHoley = false;
  const list = node.a;
  for (let i = 0, len = node.l; i < len; i++) {
    if (i !== 0) {
      // Add an empty item
      values += ',';
    }
    item = list[i];
    // Check if index is a hole
    if (item) {
      // Check if item is a parent
      if (isIndexedValueInStack(ctx, item)) {
        markRef(ctx, id);
        createArrayAssign(ctx, id, i, getRefParam(ctx, item.i));
        isHoley = true;
      } else {
        values += serializeTree(ctx, item);
        isHoley = false;
      }
    } else {
      isHoley = true;
    }
  }
  ctx.stack.pop();
  pushObjectFlag(ctx, node.o, node.i);
  return assignIndexedValue(ctx, id, '[' + values + (isHoley ? ',]' : ']'));
}

function getIterableAccess(ctx: SerializationContext): string {
  return ctx.features & Feature.ArrayPrototypeValues
    ? '.values()'
    : '[Symbol.iterator]()';
}

function serializeIterable(
  ctx: SerializationContext,
  node: SerovalNode,
): string {
  const parent = ctx.stack;
  ctx.stack = [];
  let serialized = serializeTree(ctx, node) + getIterableAccess(ctx);
  ctx.stack = parent;
  if (ctx.features & Feature.ArrowFunction) {
    serialized = '[Symbol.iterator]:()=>' + serialized;
  } else if (ctx.features & Feature.MethodShorthand) {
    serialized = '[Symbol.iterator](){return ' + serialized + '}';
  } else {
    serialized = '[Symbol.iterator]:function(){return ' + serialized + '}';
  }
  return serialized;
}

function serializeProperties(
  ctx: SerializationContext,
  sourceID: number,
  node: SerovalObjectRecordNode,
): string {
  const len = node.s;
  if (len === 0) {
    return '{}';
  }
  let result = '';
  ctx.stack.push(sourceID);
  let key: SerovalObjectRecordKey;
  let val: SerovalNode;
  let check: number;
  let isIdentifier: boolean;
  let refParam: string;
  let hasPrev = false;
  const keys = node.k;
  const values = node.v;
  for (let i = 0; i < len; i++) {
    key = keys[i];
    val = values[i];
    switch (key) {
      case SerovalObjectRecordSpecialKey.SymbolIterator:
        result += (hasPrev ? ',' : '') + serializeIterable(ctx, val);
        hasPrev = true;
        break;
      default:
        check = Number(key);
        // Test if key is a valid number or JS identifier
        // so that we don't have to serialize the key and wrap with brackets
        isIdentifier = check >= 0 || isValidIdentifier(key);
        if (isIndexedValueInStack(ctx, val)) {
          refParam = getRefParam(ctx, val.i);
          markRef(ctx, sourceID);
          if (isIdentifier && Number.isNaN(check)) {
            createObjectAssign(ctx, sourceID, key, refParam);
          } else {
            createArrayAssign(ctx, sourceID, isIdentifier ? key : ('"' + key + '"'), refParam);
          }
        } else {
          result += (hasPrev ? ',' : '')
            + (isIdentifier ? key : ('"' + key + '"'))
            + ':' + serializeTree(ctx, val);
          hasPrev = true;
        }
        break;
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
): string {
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
): string | undefined {
  ctx.stack.push(sourceID);
  const mainAssignments: Assignment[] = [];
  let key: SerovalObjectRecordKey;
  let value: SerovalNode;
  let parentAssignment: Assignment[];
  const keys = node.k;
  const values = node.v;
  for (let i = 0, len = node.s; i < len; i++) {
    key = keys[i];
    value = values[i];
    switch (key) {
      case SerovalObjectRecordSpecialKey.SymbolIterator: {
        const parent = ctx.stack;
        ctx.stack = [];
        const serialized = serializeTree(ctx, value) + getIterableAccess(ctx);
        ctx.stack = parent;
        parentAssignment = ctx.assignments;
        ctx.assignments = mainAssignments;
        createArrayAssign(
          ctx,
          sourceID,
          'Symbol.iterator',
          ctx.features & Feature.ArrowFunction
            ? '()=>' + serialized
            : 'function(){return ' + serialized + '}',
        );
        ctx.assignments = parentAssignment;
      }
        break;
      default: {
        const serialized = serializeTree(ctx, value);
        const check = Number(key);
        const isIdentifier = check >= 0 || isValidIdentifier(key);
        if (isIndexedValueInStack(ctx, value)) {
          // Test if key is a valid number or JS identifier
          // so that we don't have to serialize the key and wrap with brackets
          if (isIdentifier && Number.isNaN(check)) {
            createObjectAssign(ctx, sourceID, key, serialized);
          } else {
            createArrayAssign(ctx, sourceID, isIdentifier ? key : ('"' + key + '"'), serialized);
          }
        } else {
          // Test if key is a valid number or JS identifier
          // so that we don't have to serialize the key and wrap with brackets
          parentAssignment = ctx.assignments;
          ctx.assignments = mainAssignments;
          if (isIdentifier && Number.isNaN(check)) {
            createObjectAssign(ctx, sourceID, key, serialized);
          } else {
            createArrayAssign(ctx, sourceID, isIdentifier ? key : ('"' + key + '"'), serialized);
          }
          ctx.assignments = parentAssignment;
        }
      }
    }
  }
  ctx.stack.pop();
  return resolveAssignments(mainAssignments);
}

function serializeDictionary(
  ctx: SerializationContext,
  i: number,
  d: SerovalObjectRecordNode | undefined,
  init: string,
): string {
  if (d) {
    if (ctx.features & Feature.ObjectAssign) {
      init = serializeWithObjectAssign(ctx, d, i, init);
    } else {
      markRef(ctx, i);
      const assignments = serializeAssignments(ctx, i, d);
      if (assignments) {
        return '(' + assignIndexedValue(ctx, i, init) + ',' + assignments + getRefParam(ctx, i) + ')';
      }
    }
  }
  return assignIndexedValue(ctx, i, init);
}

const NULL_CONSTRUCTOR = 'Object.create(null)';

function serializeNullConstructor(
  ctx: SerializationContext,
  node: SerovalNullConstructorNode,
): string {
  pushObjectFlag(ctx, node.o, node.i);
  return serializeDictionary(ctx, node.i, node.d, NULL_CONSTRUCTOR);
}

function serializeObject(
  ctx: SerializationContext,
  node: SerovalObjectNode,
): string {
  pushObjectFlag(ctx, node.o, node.i);
  return assignIndexedValue(ctx, node.i, serializeProperties(ctx, node.i, node.d));
}

function serializeSet(
  ctx: SerializationContext,
  node: SerovalSetNode,
): string {
  let serialized = 'new Set';
  const size = node.l;
  const id = node.i;
  if (size) {
    let result = '';
    let item: SerovalNode;
    let hasPrev = false;
    const items = node.a;
    ctx.stack.push(id);
    for (let i = 0; i < size; i++) {
      item = items[i];
      if (isIndexedValueInStack(ctx, item)) {
        markRef(ctx, id);
        createAddAssignment(ctx, id, getRefParam(ctx, item.i));
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
  return assignIndexedValue(ctx, id, serialized);
}

function serializeMap(
  ctx: SerializationContext,
  node: SerovalMapNode,
): string {
  let serialized = 'new Map';
  const size = node.d.s;
  const id = node.i;
  if (size) {
    let result = '';
    let key: SerovalNode;
    let val: SerovalNode;
    let keyRef: string;
    let valueRef: string;
    let parent: number[];
    let hasPrev = false;
    const keys = node.d.k;
    const vals = node.d.v;
    ctx.stack.push(id);
    for (let i = 0; i < size; i++) {
      // Check if key is a parent
      key = keys[i];
      val = vals[i];
      if (isIndexedValueInStack(ctx, key)) {
        // Create reference for the map instance
        keyRef = getRefParam(ctx, id);
        markRef(ctx, id);
        // Check if value is a parent
        if (isIndexedValueInStack(ctx, val)) {
          valueRef = getRefParam(ctx, val.i);
          // Register an assignment since
          // both key and value are a parent of this
          // Map instance
          createSetAssignment(ctx, id, keyRef, valueRef);
        } else {
          // Reset the stack
          // This is required because the serialized
          // value is no longer part of the expression
          // tree and has been moved to the deferred
          // assignment
          parent = ctx.stack;
          ctx.stack = [];
          createSetAssignment(ctx, id, keyRef, serializeTree(ctx, val));
          ctx.stack = parent;
        }
      } else if (isIndexedValueInStack(ctx, val)) {
        // Create ref for the Map instance
        valueRef = getRefParam(ctx, val.i);
        markRef(ctx, id);
        // Reset stack for the key serialization
        parent = ctx.stack;
        ctx.stack = [];
        createSetAssignment(ctx, id, serializeTree(ctx, key), valueRef);
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
  return assignIndexedValue(ctx, id, serialized);
}

function serializeAggregateError(
  ctx: SerializationContext,
  node: SerovalAggregateErrorNode,
): string {
  // Serialize the required arguments
  const id = node.i;
  ctx.stack.push(id);
  const serialized = 'new AggregateError([],"' + node.m + '")';
  ctx.stack.pop();
  // `AggregateError` might've been extended
  // either through class or custom properties
  // Make sure to assign extra properties
  return serializeDictionary(ctx, id, node.d, serialized);
}

function serializeError(
  ctx: SerializationContext,
  node: SerovalErrorNode,
): string {
  return serializeDictionary(ctx, node.i, node.d, 'new ' + node.c + '("' + node.m + '")');
}

const PROMISE_RESOLVE = 'Promise.resolve';
const PROMISE_REJECT = 'Promise.reject';

function serializePromise(
  ctx: SerializationContext,
  node: SerovalPromiseNode,
): string {
  let serialized: string;
  // Check if resolved value is a parent expression
  const fulfilled = node.f;
  const id = node.i;
  const constructor = node.s ? PROMISE_RESOLVE : PROMISE_REJECT;
  if (isIndexedValueInStack(ctx, fulfilled)) {
    // A Promise trick, reference the value
    // inside the `then` expression so that
    // the Promise evaluates after the parent
    // has initialized
    const ref = getRefParam(ctx, fulfilled.i);
    if (ctx.features & Feature.ArrowFunction) {
      if (node.s) {
        serialized = constructor + '().then(()=>' + ref + ')';
      } else {
        serialized = constructor + '().catch(()=>{throw ' + ref + '})';
      }
    } else if (node.s) {
      serialized = constructor + '().then(function(){return ' + ref + '})';
    } else {
      serialized = constructor + '().catch(function(){throw ' + ref + '})';
    }
  } else {
    ctx.stack.push(id);
    const result = serializeTree(ctx, fulfilled);
    ctx.stack.pop();
    // just inline the value/reference here
    serialized = constructor + '(' + result + ')';
  }
  return assignIndexedValue(ctx, id, serialized);
}

function serializeArrayBuffer(
  ctx: SerializationContext,
  node: SerovalArrayBufferNode,
): string {
  let result = 'new Uint8Array(';
  const buffer = node.s;
  const len = buffer.length;
  if (len) {
    result += '[';
    for (let i = 0; i < len; i++) {
      result += ((i > 0) ? ',' : '') + buffer[i];
    }
    result += ']';
  }
  return assignIndexedValue(ctx, node.i, result + ').buffer');
}

function serializeTypedArray(
  ctx: SerializationContext,
  node: SerovalTypedArrayNode | SerovalBigIntTypedArrayNode,
): string {
  return assignIndexedValue(
    ctx,
    node.i,
    'new ' + node.c + '(' + serializeTree(ctx, node.f) + ',' + node.b + ',' + node.l + ')',
  );
}

function serializeDate(
  ctx: SerializationContext,
  node: SerovalDateNode,
): string {
  return assignIndexedValue(ctx, node.i, 'new Date("' + node.s + '")');
}

function serializeRegExp(
  ctx: SerializationContext,
  node: SerovalRegExpNode,
): string {
  return assignIndexedValue(ctx, node.i, '/' + node.c + '/' + node.m);
}

function serializeURL(
  ctx: SerializationContext,
  node: SerovalURLNode,
): string {
  return assignIndexedValue(ctx, node.i, 'new URL("' + node.s + '")');
}

function serializeURLSearchParams(
  ctx: SerializationContext,
  node: SerovalURLSearchParamsNode,
): string {
  return assignIndexedValue(
    ctx,
    node.i,
    node.s ? 'new URLSearchParams("' + node.s + '")' : 'new URLSearchParams',
  );
}

function serializeReference(
  ctx: SerializationContext,
  node: SerovalReferenceNode,
): string {
  return assignIndexedValue(ctx, node.i, GLOBAL_KEY + '.get("' + node.s + '")');
}

function serializeDataView(
  ctx: SerializationContext,
  node: SerovalDataViewNode,
): string {
  return assignIndexedValue(
    ctx,
    node.i,
    'new DataView(' + serializeTree(ctx, node.f) + ',' + node.b + ',' + node.l + ')',
  );
}

function serializeBlob(
  ctx: SerializationContext,
  node: SerovalBlobNode,
): string {
  return assignIndexedValue(
    ctx,
    node.i,
    'new Blob([' + serializeTree(ctx, node.f) + '],{type:"' + node.c + '"})',
  );
}

function serializeFile(
  ctx: SerializationContext,
  node: SerovalFileNode,
): string {
  return assignIndexedValue(
    ctx,
    node.i,
    'new File([' + serializeTree(ctx, node.f) + '],"' + node.m + '",{type:"' + node.c + '",lastModified:' + node.b + '})',
  );
}

function serializeHeaders(
  ctx: SerializationContext,
  node: SerovalHeadersNode,
): string {
  return assignIndexedValue(
    ctx,
    node.i,
    'new Headers(' + serializeProperties(ctx, node.i, node.d) + ')',
  );
}

function serializeFormDataEntries(
  ctx: SerializationContext,
  node: SerovalFormDataNode,
): string | undefined {
  let value: string;
  let key: string;
  const keys = node.d.k;
  const vals = node.d.v;
  const id = node.i;
  const mainAssignments: Assignment[] = [];
  let parentAssignment: Assignment[];
  ctx.stack.push(id);
  for (let i = 0, len = node.d.s; i < len; i++) {
    key = keys[i];
    value = serializeTree(ctx, vals[i]);
    parentAssignment = ctx.assignments;
    ctx.assignments = mainAssignments;
    createAppendAssignment(ctx, id, '"' + key + '"', value);
    ctx.assignments = parentAssignment;
  }
  ctx.stack.pop();
  return resolveAssignments(mainAssignments);
}

function serializeFormData(
  ctx: SerializationContext,
  node: SerovalFormDataNode,
): string {
  const size = node.d.s;
  const id = node.i;
  if (size) {
    markRef(ctx, id);
  }
  const result = assignIndexedValue(ctx, id, 'new FormData()');
  if (size) {
    const entries = serializeFormDataEntries(ctx, node);
    return '(' + result + ',' + (entries == null ? '' : entries) + getRefParam(ctx, id) + ')';
  }
  return result;
}

function serializeBoxed(
  ctx: SerializationContext,
  node: SerovalBoxedNode,
): string {
  return assignIndexedValue(ctx, node.i, 'Object(' + serializeTree(ctx, node.f) + ')');
}

function serializeWKSymbol(
  ctx: SerializationContext,
  node: SerovalWKSymbolNode,
): string {
  return assignIndexedValue(ctx, node.i, SYMBOL_STRING[node.s]);
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
    case SerovalNodeType.Constant:
      return serializeConstant(node);
    case SerovalNodeType.BigInt:
      return node.s + 'n';
    case SerovalNodeType.IndexedValue:
      return getRefParam(ctx, node.i);
    case SerovalNodeType.Array:
      return serializeArray(ctx, node);
    case SerovalNodeType.Object:
      return serializeObject(ctx, node);
    case SerovalNodeType.NullConstructor:
      return serializeNullConstructor(ctx, node);
    case SerovalNodeType.Date:
      return serializeDate(ctx, node);
    case SerovalNodeType.RegExp:
      return serializeRegExp(ctx, node);
    case SerovalNodeType.Set:
      return serializeSet(ctx, node);
    case SerovalNodeType.Map:
      return serializeMap(ctx, node);
    case SerovalNodeType.ArrayBuffer:
      return serializeArrayBuffer(ctx, node);
    case SerovalNodeType.BigIntTypedArray:
    case SerovalNodeType.TypedArray:
      return serializeTypedArray(ctx, node);
    case SerovalNodeType.DataView:
      return serializeDataView(ctx, node);
    case SerovalNodeType.AggregateError:
      return serializeAggregateError(ctx, node);
    case SerovalNodeType.Error:
      return serializeError(ctx, node);
    case SerovalNodeType.Promise:
      return serializePromise(ctx, node);
    case SerovalNodeType.WKSymbol:
      return serializeWKSymbol(ctx, node);
    case SerovalNodeType.URL:
      return serializeURL(ctx, node);
    case SerovalNodeType.URLSearchParams:
      return serializeURLSearchParams(ctx, node);
    case SerovalNodeType.Reference:
      return serializeReference(ctx, node);
    case SerovalNodeType.Blob:
      return serializeBlob(ctx, node);
    case SerovalNodeType.File:
      return serializeFile(ctx, node);
    case SerovalNodeType.Headers:
      return serializeHeaders(ctx, node);
    case SerovalNodeType.FormData:
      return serializeFormData(ctx, node);
    case SerovalNodeType.Boxed:
      return serializeBoxed(ctx, node);
    default:
      throw new Error('invariant');
  }
}