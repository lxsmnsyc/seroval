/* eslint-disable @typescript-eslint/no-use-before-define */
import { Feature } from '../compat';
import type {
  CrossSerializerContext,
} from './context';
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
  SerovalPromiseConstructorNode,
  SerovalPromiseResolveNode,
  SerovalPromiseRejectNode,
  SerovalReadableStreamCloseNode,
  SerovalReadableStreamEnqueueNode,
  SerovalReadableStreamErrorNode,
  SerovalReadableStreamConstructorNode,
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
import type { Assignment } from '../assignments';
import { resolveAssignments, resolveFlags } from '../assignments';
import {
  GLOBAL_CONTEXT_PROMISE_REJECT,
  GLOBAL_CONTEXT_PROMISE_RESOLVE,
  GLOBAL_CONTEXT_PROMISE_CONSTRUCTOR,
  GLOBAL_CONTEXT_REFERENCES,
  REFERENCES_KEY,
  GLOBAL_CONTEXT_STREAM_CONSTRUCTOR,
  GLOBAL_CONTEXT_STREAM_EMIT,
  GLOBAL_CONTEXT_API,
} from '../keys';

export function getRefExpr(id: number): string {
  return GLOBAL_CONTEXT_REFERENCES + '[' + id + ']';
}

function pushObjectFlag(
  ctx: CrossSerializerContext,
  flag: SerovalObjectFlags,
  id: number,
): void {
  if (flag !== SerovalObjectFlags.None) {
    ctx.flags.push({
      type: flag,
      value: getRefExpr(id),
    });
  }
}

export function resolvePatches(ctx: CrossSerializerContext): string | undefined {
  const assignments = resolveAssignments(ctx.assignments);
  const flags = resolveFlags(ctx.flags);
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
  ctx: CrossSerializerContext,
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
  ctx: CrossSerializerContext,
  ref: number,
  value: string,
): void {
  ctx.assignments.push({
    t: 'add',
    s: getRefExpr(ref),
    k: undefined,
    v: value,
  });
}

function createSetAssignment(
  ctx: CrossSerializerContext,
  ref: number,
  key: string,
  value: string,
): void {
  ctx.assignments.push({
    t: 'set',
    s: getRefExpr(ref),
    k: key,
    v: value,
  });
}

function createAppendAssignment(
  ctx: CrossSerializerContext,
  ref: number,
  key: string,
  value: string,
): void {
  ctx.assignments.push({
    t: 'append',
    s: getRefExpr(ref),
    k: key,
    v: value,
  });
}

function createArrayAssign(
  ctx: CrossSerializerContext,
  ref: number,
  index: number | string,
  value: string,
): void {
  createAssignment(ctx, getRefExpr(ref) + '[' + index + ']', value);
}

function createObjectAssign(
  ctx: CrossSerializerContext,
  ref: number,
  key: string,
  value: string,
): void {
  createAssignment(ctx, getRefExpr(ref) + '.' + key, value);
}

function assignIndexedValue(
  index: number,
  value: string,
): string {
  return getRefExpr(index) + '=' + value;
}

function isIndexedValueInStack(
  ctx: CrossSerializerContext,
  node: SerovalNode,
): node is SerovalIndexedValueNode {
  return node.t === SerovalNodeType.IndexedValue && ctx.stack.includes(node.i);
}

function serializeArray(
  ctx: CrossSerializerContext,
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
        createArrayAssign(ctx, id, i, getRefExpr(item.i));
        isHoley = true;
      } else {
        values += crossSerializeTree(ctx, item);
        isHoley = false;
      }
    } else {
      isHoley = true;
    }
  }
  ctx.stack.pop();
  pushObjectFlag(ctx, node.o, node.i);
  return assignIndexedValue(id, '[' + values + (isHoley ? ',]' : ']'));
}

function getIterableAccess(ctx: CrossSerializerContext): string {
  return ctx.features & Feature.ArrayPrototypeValues
    ? '.values()'
    : '[Symbol.iterator]()';
}

function serializeIterable(
  ctx: CrossSerializerContext,
  node: SerovalNode,
): string {
  const parent = ctx.stack;
  ctx.stack = [];
  let serialized = crossSerializeTree(ctx, node) + getIterableAccess(ctx);
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
  ctx: CrossSerializerContext,
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
          refParam = getRefExpr(val.i);
          if (isIdentifier && Number.isNaN(check)) {
            createObjectAssign(ctx, sourceID, key, refParam);
          } else {
            createArrayAssign(ctx, sourceID, isIdentifier ? key : ('"' + key + '"'), refParam);
          }
        } else {
          result += (hasPrev ? ',' : '')
            + (isIdentifier ? key : ('"' + key + '"'))
            + ':' + crossSerializeTree(ctx, val);
          hasPrev = true;
        }
        break;
    }
  }
  ctx.stack.pop();
  return '{' + result + '}';
}

function serializeWithObjectAssign(
  ctx: CrossSerializerContext,
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
  ctx: CrossSerializerContext,
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
        const serialized = crossSerializeTree(ctx, value) + getIterableAccess(ctx);
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
        const serialized = crossSerializeTree(ctx, value);
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
  ctx: CrossSerializerContext,
  i: number,
  p: SerovalObjectRecordNode | undefined,
  init: string,
): string {
  if (p) {
    if (ctx.features & Feature.ObjectAssign) {
      init = serializeWithObjectAssign(ctx, p, i, init);
    } else {
      const assignments = serializeAssignments(ctx, i, p);
      if (assignments) {
        return '(' + assignIndexedValue(i, init) + ',' + assignments + getRefExpr(i) + ')';
      }
    }
  }
  return assignIndexedValue(i, init);
}

const NULL_CONSTRUCTOR = 'Object.create(null)';

function serializeNullConstructor(
  ctx: CrossSerializerContext,
  node: SerovalNullConstructorNode,
): string {
  pushObjectFlag(ctx, node.o, node.i);
  return serializeDictionary(ctx, node.i, node.p, NULL_CONSTRUCTOR);
}

function serializeObject(
  ctx: CrossSerializerContext,
  node: SerovalObjectNode,
): string {
  pushObjectFlag(ctx, node.o, node.i);
  return assignIndexedValue(node.i, serializeProperties(ctx, node.i, node.p));
}

function serializeSet(
  ctx: CrossSerializerContext,
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
        createAddAssignment(ctx, id, getRefExpr(item.i));
      } else {
        // Push directly
        result += (hasPrev ? ',' : '') + crossSerializeTree(ctx, item);
        hasPrev = true;
      }
    }
    ctx.stack.pop();
    if (result) {
      serialized += '([' + result + '])';
    }
  }
  return assignIndexedValue(id, serialized);
}

function serializeMap(
  ctx: CrossSerializerContext,
  node: SerovalMapNode,
): string {
  let serialized = 'new Map';
  const size = node.e.s;
  const id = node.i;
  if (size) {
    let result = '';
    let key: SerovalNode;
    let val: SerovalNode;
    let keyRef: string;
    let valueRef: string;
    let parent: number[];
    let hasPrev = false;
    const keys = node.e.k;
    const vals = node.e.v;
    ctx.stack.push(id);
    for (let i = 0; i < size; i++) {
      // Check if key is a parent
      key = keys[i];
      val = vals[i];
      if (isIndexedValueInStack(ctx, key)) {
        // Create reference for the map instance
        keyRef = getRefExpr(id);
        // Check if value is a parent
        if (isIndexedValueInStack(ctx, val)) {
          valueRef = getRefExpr(val.i);
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
          createSetAssignment(ctx, id, keyRef, crossSerializeTree(ctx, val));
          ctx.stack = parent;
        }
      } else if (isIndexedValueInStack(ctx, val)) {
        // Create ref for the Map instance
        valueRef = getRefExpr(val.i);
        // Reset stack for the key serialization
        parent = ctx.stack;
        ctx.stack = [];
        createSetAssignment(ctx, id, crossSerializeTree(ctx, key), valueRef);
        ctx.stack = parent;
      } else {
        result += (hasPrev ? ',[' : '[') + crossSerializeTree(ctx, key) + ',' + crossSerializeTree(ctx, val) + ']';
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
  return assignIndexedValue(id, serialized);
}

function serializeAggregateError(
  ctx: CrossSerializerContext,
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
  return serializeDictionary(ctx, id, node.p, serialized);
}

function serializeError(
  ctx: CrossSerializerContext,
  node: SerovalErrorNode,
): string {
  return serializeDictionary(ctx, node.i, node.p, 'new ' + node.c + '("' + node.m + '")');
}

const PROMISE_RESOLVE = 'Promise.resolve';
const PROMISE_REJECT = 'Promise.reject';

function serializePromise(
  ctx: CrossSerializerContext,
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
    const ref = getRefExpr(fulfilled.i);
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
    const result = crossSerializeTree(ctx, fulfilled);
    ctx.stack.pop();
    // just inline the value/reference here
    serialized = constructor + '(' + result + ')';
  }
  return assignIndexedValue(id, serialized);
}

function serializeArrayBuffer(
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
  return assignIndexedValue(node.i, result + ').buffer');
}

function serializeTypedArray(
  ctx: CrossSerializerContext,
  node: SerovalTypedArrayNode | SerovalBigIntTypedArrayNode,
): string {
  return assignIndexedValue(
    node.i,
    'new ' + node.c + '(' + crossSerializeTree(ctx, node.f) + ',' + node.b + ',' + node.l + ')',
  );
}

function serializeDate(
  node: SerovalDateNode,
): string {
  return assignIndexedValue(node.i, 'new Date("' + node.s + '")');
}

function serializeRegExp(
  node: SerovalRegExpNode,
): string {
  return assignIndexedValue(node.i, '/' + node.c + '/' + node.m);
}

function serializeURL(
  node: SerovalURLNode,
): string {
  return assignIndexedValue(node.i, 'new URL("' + node.s + '")');
}

function serializeURLSearchParams(
  node: SerovalURLSearchParamsNode,
): string {
  return assignIndexedValue(
    node.i,
    node.s ? 'new URLSearchParams("' + node.s + '")' : 'new URLSearchParams',
  );
}

function serializeReference(
  node: SerovalReferenceNode,
): string {
  return assignIndexedValue(node.i, REFERENCES_KEY + '.get("' + node.s + '")');
}

function serializeDataView(
  ctx: CrossSerializerContext,
  node: SerovalDataViewNode,
): string {
  return assignIndexedValue(
    node.i,
    'new DataView(' + crossSerializeTree(ctx, node.f) + ',' + node.b + ',' + node.l + ')',
  );
}

function serializeBlob(
  ctx: CrossSerializerContext,
  node: SerovalBlobNode,
): string {
  return assignIndexedValue(
    node.i,
    'new Blob([' + crossSerializeTree(ctx, node.f) + '],{type:"' + node.c + '"})',
  );
}

function serializeFile(
  ctx: CrossSerializerContext,
  node: SerovalFileNode,
): string {
  return assignIndexedValue(
    node.i,
    'new File([' + crossSerializeTree(ctx, node.f) + '],"' + node.m + '",{type:"' + node.c + '",lastModified:' + node.b + '})',
  );
}

function serializeHeaders(
  ctx: CrossSerializerContext,
  node: SerovalHeadersNode,
): string {
  return assignIndexedValue(
    node.i,
    'new Headers(' + serializeProperties(ctx, node.i, node.e) + ')',
  );
}

function serializeFormDataEntries(
  ctx: CrossSerializerContext,
  node: SerovalFormDataNode,
): string | undefined {
  let value: string;
  let key: string;
  const keys = node.e.k;
  const vals = node.e.v;
  const id = node.i;
  const mainAssignments: Assignment[] = [];
  let parentAssignment: Assignment[];
  ctx.stack.push(id);
  for (let i = 0, len = node.e.s; i < len; i++) {
    key = keys[i];
    value = crossSerializeTree(ctx, vals[i]);
    parentAssignment = ctx.assignments;
    ctx.assignments = mainAssignments;
    createAppendAssignment(ctx, id, '"' + key + '"', value);
    ctx.assignments = parentAssignment;
  }
  ctx.stack.pop();
  return resolveAssignments(mainAssignments);
}

function serializeFormData(
  ctx: CrossSerializerContext,
  node: SerovalFormDataNode,
): string {
  const size = node.e.s;
  const id = node.i;
  const result = assignIndexedValue(id, 'new FormData()');
  if (size) {
    const entries = serializeFormDataEntries(ctx, node);
    return '(' + result + ',' + (entries == null ? '' : entries) + getRefExpr(id) + ')';
  }
  return result;
}

function serializeBoxed(
  ctx: CrossSerializerContext,
  node: SerovalBoxedNode,
): string {
  return assignIndexedValue(node.i, 'Object(' + crossSerializeTree(ctx, node.f) + ')');
}

function serializeWKSymbol(
  node: SerovalWKSymbolNode,
): string {
  return assignIndexedValue(node.i, SYMBOL_STRING[node.s]);
}

function serializePromiseResolve(
  ctx: CrossSerializerContext,
  node: SerovalPromiseResolveNode,
): string {
  return GLOBAL_CONTEXT_API + '.' + GLOBAL_CONTEXT_PROMISE_RESOLVE + '(' + getRefExpr(node.i) + ',' + crossSerializeTree(ctx, node.f) + ')';
}

function serializePromiseReject(
  ctx: CrossSerializerContext,
  node: SerovalPromiseRejectNode,
): string {
  return GLOBAL_CONTEXT_API + '.' + GLOBAL_CONTEXT_PROMISE_REJECT + '(' + getRefExpr(node.i) + ',' + crossSerializeTree(ctx, node.f) + ')';
}

function serializePromiseConstructor(
  node: SerovalPromiseConstructorNode,
): string {
  return assignIndexedValue(node.i, GLOBAL_CONTEXT_API + '.' + GLOBAL_CONTEXT_PROMISE_CONSTRUCTOR + '()');
}

function serializeReadableStreamClose(
  node: SerovalReadableStreamCloseNode,
): string {
  return GLOBAL_CONTEXT_API + '.' + GLOBAL_CONTEXT_STREAM_EMIT + '(' + getRefExpr(node.i) + ',2)';
}

function serializeReadableStreamEnqueue(
  ctx: CrossSerializerContext,
  node: SerovalReadableStreamEnqueueNode,
): string {
  return GLOBAL_CONTEXT_API + '.' + GLOBAL_CONTEXT_STREAM_EMIT + '(' + getRefExpr(node.i) + ',0,' + crossSerializeTree(ctx, node.f) + ')';
}

function serializeReadableStreamError(
  ctx: CrossSerializerContext,
  node: SerovalReadableStreamErrorNode,
): string {
  return GLOBAL_CONTEXT_API + '.' + GLOBAL_CONTEXT_STREAM_EMIT + '(' + getRefExpr(node.i) + ',1,' + crossSerializeTree(ctx, node.f) + ')';
}

function serializeReadableStreamConstructor(
  node: SerovalReadableStreamConstructorNode,
): string {
  return assignIndexedValue(node.i, GLOBAL_CONTEXT_API + '.' + GLOBAL_CONTEXT_STREAM_CONSTRUCTOR + '()');
}

export default function crossSerializeTree(
  ctx: CrossSerializerContext,
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
      return getRefExpr(node.i);
    case SerovalNodeType.Array:
      return serializeArray(ctx, node);
    case SerovalNodeType.Object:
      return serializeObject(ctx, node);
    case SerovalNodeType.NullConstructor:
      return serializeNullConstructor(ctx, node);
    case SerovalNodeType.Date:
      return serializeDate(node);
    case SerovalNodeType.RegExp:
      return serializeRegExp(node);
    case SerovalNodeType.Set:
      return serializeSet(ctx, node);
    case SerovalNodeType.Map:
      return serializeMap(ctx, node);
    case SerovalNodeType.ArrayBuffer:
      return serializeArrayBuffer(node);
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
      return serializeWKSymbol(node);
    case SerovalNodeType.URL:
      return serializeURL(node);
    case SerovalNodeType.URLSearchParams:
      return serializeURLSearchParams(node);
    case SerovalNodeType.Reference:
      return serializeReference(node);
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
    case SerovalNodeType.PromiseResolve:
      return serializePromiseResolve(ctx, node);
    case SerovalNodeType.PromiseReject:
      return serializePromiseReject(ctx, node);
    case SerovalNodeType.PromiseConstructor:
      return serializePromiseConstructor(node);
    case SerovalNodeType.ReadableStreamClose:
      return serializeReadableStreamClose(node);
    case SerovalNodeType.ReadableStreamConstructor:
      return serializeReadableStreamConstructor(node);
    case SerovalNodeType.ReadableStreamEnqueue:
      return serializeReadableStreamEnqueue(ctx, node);
    case SerovalNodeType.ReadableStreamError:
      return serializeReadableStreamError(ctx, node);
    default:
      throw new Error('invariant');
  }
}
