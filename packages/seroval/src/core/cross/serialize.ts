/* eslint-disable @typescript-eslint/no-use-before-define */
import { Feature } from '../compat';
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
  SerovalRequestNode,
  SerovalResponseNode,
  SerovalEventNode,
  SerovalCustomEventNode,
  SerovalDOMExceptionNode,
  SerovalPluginNode,
} from '../types';
import {
  SerovalObjectRecordSpecialKey,
} from '../types';
import {
  SerovalObjectFlags,
  SerovalNodeType,
  SYMBOL_STRING,
  ERROR_CONSTRUCTOR_STRING,
  CONSTANT_STRING,
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
import { BaseSerializerContext } from '../serializer-context';

const NULL_CONSTRUCTOR = 'Object.create(null)';

const PROMISE_RESOLVE = 'Promise.resolve';
const PROMISE_REJECT = 'Promise.reject';

export default class CrossSerializerContext extends BaseSerializerContext {
  private pushObjectFlag(
    flag: SerovalObjectFlags,
    id: number,
  ): void {
    if (flag !== SerovalObjectFlags.None) {
      this.flags.push({
        type: flag,
        value: this.getRefParam(id),
      });
    }
  }

  /**
   * @private
   */
  resolvePatches(): string | undefined {
    const assignments = resolveAssignments(this.assignments);
    const flags = resolveFlags(this.flags);
    if (assignments) {
      if (flags) {
        return assignments + flags;
      }
      return assignments;
    }
    return flags;
  }

  getRefParam(id: number): string {
    return GLOBAL_CONTEXT_REFERENCES + '[' + id + ']';
  }

  /**
   * Generates the inlined assignment for the reference
   * This is different from the assignments array as this one
   * signifies creation rather than mutation
   */
  private createAssignment(
    source: string,
    value: string,
  ): void {
    this.assignments.push({
      t: 'index',
      s: source,
      k: undefined,
      v: value,
    });
  }

  private createAddAssignment(
    ref: number,
    value: string,
  ): void {
    this.assignments.push({
      t: 'add',
      s: this.getRefParam(ref),
      k: undefined,
      v: value,
    });
  }

  private createSetAssignment(
    ref: number,
    key: string,
    value: string,
  ): void {
    this.assignments.push({
      t: 'set',
      s: this.getRefParam(ref),
      k: key,
      v: value,
    });
  }

  private createArrayAssign(
    ref: number,
    index: number | string,
    value: string,
  ): void {
    this.createAssignment(this.getRefParam(ref) + '[' + index + ']', value);
  }

  private createObjectAssign(
    ref: number,
    key: string,
    value: string,
  ): void {
    this.createAssignment(this.getRefParam(ref) + '.' + key, value);
  }

  isIndexedValueInStack(
    node: SerovalNode,
  ): node is SerovalIndexedValueNode {
    return node.t === SerovalNodeType.IndexedValue && this.stack.includes(node.i);
  }

  private assignIndexedValue(
    index: number,
    value: string,
  ): string {
    return this.getRefParam(index) + '=' + value;
  }

  private serializeReference(
    node: SerovalReferenceNode,
  ): string {
    return this.assignIndexedValue(node.i, REFERENCES_KEY + '.get("' + node.s + '")');
  }

  private serializeArray(
    node: SerovalArrayNode,
  ): string {
    const id = node.i;
    this.stack.push(id);
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
        if (this.isIndexedValueInStack(item)) {
          this.createArrayAssign(id, i, this.getRefParam(item.i));
          isHoley = true;
        } else {
          values += this.serialize(item);
          isHoley = false;
        }
      } else {
        isHoley = true;
      }
    }
    this.stack.pop();
    this.pushObjectFlag(node.o, node.i);
    return this.assignIndexedValue(id, '[' + values + (isHoley ? ',]' : ']'));
  }

  private getIterableAccess(): string {
    return this.features & Feature.ArrayPrototypeValues
      ? '.values()'
      : '[Symbol.iterator]()';
  }

  private serializeIterable(
    node: SerovalNode,
  ): string {
    const parent = this.stack;
    this.stack = [];
    let serialized = this.serialize(node) + this.getIterableAccess();
    this.stack = parent;
    if (this.features & Feature.ArrowFunction) {
      serialized = '[Symbol.iterator]:()=>' + serialized;
    } else if (this.features & Feature.MethodShorthand) {
      serialized = '[Symbol.iterator](){return ' + serialized + '}';
    } else {
      serialized = '[Symbol.iterator]:function(){return ' + serialized + '}';
    }
    return serialized;
  }

  private serializeProperties(
    sourceID: number,
    node: SerovalObjectRecordNode,
  ): string {
    const len = node.s;
    if (len === 0) {
      return '{}';
    }
    let result = '';
    this.stack.push(sourceID);
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
          result += (hasPrev ? ',' : '') + this.serializeIterable(val);
          hasPrev = true;
          break;
        default:
          check = Number(key);
          // Test if key is a valid number or JS identifier
          // so that we don't have to serialize the key and wrap with brackets
          isIdentifier = check >= 0 || isValidIdentifier(key);
          if (this.isIndexedValueInStack(val)) {
            refParam = this.getRefParam(val.i);
            if (isIdentifier && Number.isNaN(check)) {
              this.createObjectAssign(sourceID, key, refParam);
            } else {
              this.createArrayAssign(sourceID, isIdentifier ? key : ('"' + key + '"'), refParam);
            }
          } else {
            result += (hasPrev ? ',' : '')
            + (isIdentifier ? key : ('"' + key + '"'))
            + ':' + this.serialize(val);
            hasPrev = true;
          }
          break;
      }
    }
    this.stack.pop();
    return '{' + result + '}';
  }

  private serializeWithObjectAssign(
    value: SerovalObjectRecordNode,
    id: number,
    serialized: string,
  ): string {
    const fields = this.serializeProperties(id, value);
    if (fields !== '{}') {
      return 'Object.assign(' + serialized + ',' + fields + ')';
    }
    return serialized;
  }

  private serializeAssignments(
    sourceID: number,
    node: SerovalObjectRecordNode,
  ): string | undefined {
    this.stack.push(sourceID);
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
          const parent = this.stack;
          this.stack = [];
          const serialized = this.serialize(value) + this.getIterableAccess();
          this.stack = parent;
          parentAssignment = this.assignments;
          this.assignments = mainAssignments;
          this.createArrayAssign(
            sourceID,
            'Symbol.iterator',
            this.features & Feature.ArrowFunction
              ? '()=>' + serialized
              : 'function(){return ' + serialized + '}',
          );
          this.assignments = parentAssignment;
        }
          break;
        default: {
          const serialized = this.serialize(value);
          const check = Number(key);
          const isIdentifier = check >= 0 || isValidIdentifier(key);
          if (this.isIndexedValueInStack(value)) {
          // Test if key is a valid number or JS identifier
          // so that we don't have to serialize the key and wrap with brackets
            if (isIdentifier && Number.isNaN(check)) {
              this.createObjectAssign(sourceID, key, serialized);
            } else {
              this.createArrayAssign(sourceID, isIdentifier ? key : ('"' + key + '"'), serialized);
            }
          } else {
          // Test if key is a valid number or JS identifier
          // so that we don't have to serialize the key and wrap with brackets
            parentAssignment = this.assignments;
            this.assignments = mainAssignments;
            if (isIdentifier && Number.isNaN(check)) {
              this.createObjectAssign(sourceID, key, serialized);
            } else {
              this.createArrayAssign(sourceID, isIdentifier ? key : ('"' + key + '"'), serialized);
            }
            this.assignments = parentAssignment;
          }
        }
      }
    }
    this.stack.pop();
    return resolveAssignments(mainAssignments);
  }

  private serializeDictionary(
    i: number,
    p: SerovalObjectRecordNode | undefined,
    init: string,
  ): string {
    if (p) {
      if (this.features & Feature.ObjectAssign) {
        init = this.serializeWithObjectAssign(p, i, init);
      } else {
        const assignments = this.serializeAssignments(i, p);
        if (assignments) {
          return '(' + this.assignIndexedValue(i, init) + ',' + assignments + this.getRefParam(i) + ')';
        }
      }
    }
    return this.assignIndexedValue(i, init);
  }

  private serializeNullConstructor(
    node: SerovalNullConstructorNode,
  ): string {
    this.pushObjectFlag(node.o, node.i);
    return this.serializeDictionary(node.i, node.p, NULL_CONSTRUCTOR);
  }

  private serializeObject(
    node: SerovalObjectNode,
  ): string {
    this.pushObjectFlag(node.o, node.i);
    return this.assignIndexedValue(node.i, this.serializeProperties(node.i, node.p));
  }

  private serializeDate(
    node: SerovalDateNode,
  ): string {
    return this.assignIndexedValue(node.i, 'new Date("' + node.s + '")');
  }

  private serializeRegExp(
    node: SerovalRegExpNode,
  ): string {
    return this.assignIndexedValue(node.i, '/' + node.c + '/' + node.m);
  }

  private serializeSet(
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
      this.stack.push(id);
      for (let i = 0; i < size; i++) {
        item = items[i];
        if (this.isIndexedValueInStack(item)) {
          this.createAddAssignment(id, this.getRefParam(item.i));
        } else {
        // Push directly
          result += (hasPrev ? ',' : '') + this.serialize(item);
          hasPrev = true;
        }
      }
      this.stack.pop();
      if (result) {
        serialized += '([' + result + '])';
      }
    }
    return this.assignIndexedValue(id, serialized);
  }

  private serializeMap(
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
      this.stack.push(id);
      for (let i = 0; i < size; i++) {
      // Check if key is a parent
        key = keys[i];
        val = vals[i];
        if (this.isIndexedValueInStack(key)) {
        // Create reference for the map instance
          keyRef = this.getRefParam(id);
          // Check if value is a parent
          if (this.isIndexedValueInStack(val)) {
            valueRef = this.getRefParam(val.i);
            // Register an assignment since
            // both key and value are a parent of this
            // Map instance
            this.createSetAssignment(id, keyRef, valueRef);
          } else {
          // Reset the stack
          // This is required because the serialized
          // value is no longer part of the expression
          // tree and has been moved to the deferred
          // assignment
            parent = this.stack;
            this.stack = [];
            this.createSetAssignment(id, keyRef, this.serialize(val));
            this.stack = parent;
          }
        } else if (this.isIndexedValueInStack(val)) {
        // Create ref for the Map instance
          valueRef = this.getRefParam(val.i);
          // Reset stack for the key serialization
          parent = this.stack;
          this.stack = [];
          this.createSetAssignment(id, this.serialize(key), valueRef);
          this.stack = parent;
        } else {
          result += (hasPrev ? ',[' : '[') + this.serialize(key) + ',' + this.serialize(val) + ']';
          hasPrev = true;
        }
      }
      this.stack.pop();
      // Check if there are any values
      // so that the empty Map constructor
      // can be used instead
      if (result) {
        serialized += '([' + result + '])';
      }
    }
    return this.assignIndexedValue(id, serialized);
  }

  private serializeArrayBuffer(
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
    return this.assignIndexedValue(node.i, result + ').buffer');
  }

  private serializeTypedArray(
    node: SerovalTypedArrayNode | SerovalBigIntTypedArrayNode,
  ): string {
    return this.assignIndexedValue(
      node.i,
      'new ' + node.c + '(' + this.serialize(node.f) + ',' + node.b + ',' + node.l + ')',
    );
  }

  private serializeDataView(
    node: SerovalDataViewNode,
  ): string {
    return this.assignIndexedValue(
      node.i,
      'new DataView(' + this.serialize(node.f) + ',' + node.b + ',' + node.l + ')',
    );
  }

  private serializeAggregateError(
    node: SerovalAggregateErrorNode,
  ): string {
  // Serialize the required arguments
    const id = node.i;
    this.stack.push(id);
    const serialized = 'new AggregateError([],"' + node.m + '")';
    this.stack.pop();
    // `AggregateError` might've been extended
    // either through class or custom properties
    // Make sure to assign extra properties
    return this.serializeDictionary(id, node.p, serialized);
  }

  private serializeError(
    node: SerovalErrorNode,
  ): string {
    return this.serializeDictionary(node.i, node.p, 'new ' + ERROR_CONSTRUCTOR_STRING[node.s] + '("' + node.m + '")');
  }

  private serializePromise(
    node: SerovalPromiseNode,
  ): string {
    let serialized: string;
    // Check if resolved value is a parent expression
    const fulfilled = node.f;
    const id = node.i;
    const constructor = node.s ? PROMISE_RESOLVE : PROMISE_REJECT;
    if (this.isIndexedValueInStack(fulfilled)) {
    // A Promise trick, reference the value
    // inside the `then` expression so that
    // the Promise evaluates after the parent
    // has initialized
      const ref = this.getRefParam(fulfilled.i);
      if (this.features & Feature.ArrowFunction) {
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
      this.stack.push(id);
      const result = this.serialize(fulfilled);
      this.stack.pop();
      // just inline the value/reference here
      serialized = constructor + '(' + result + ')';
    }
    return this.assignIndexedValue(id, serialized);
  }

  private serializeWKSymbol(
    node: SerovalWKSymbolNode,
  ): string {
    return this.assignIndexedValue(node.i, SYMBOL_STRING[node.s]);
  }

  private serializeURL(
    node: SerovalURLNode,
  ): string {
    return this.assignIndexedValue(node.i, 'new URL("' + node.s + '")');
  }

  private serializeURLSearchParams(
    node: SerovalURLSearchParamsNode,
  ): string {
    return this.assignIndexedValue(
      node.i,
      node.s ? 'new URLSearchParams("' + node.s + '")' : 'new URLSearchParams',
    );
  }

  private serializeBlob(
    node: SerovalBlobNode,
  ): string {
    return this.assignIndexedValue(
      node.i,
      'new Blob([' + this.serialize(node.f) + '],{type:"' + node.c + '"})',
    );
  }

  private serializeFile(
    node: SerovalFileNode,
  ): string {
    return this.assignIndexedValue(
      node.i,
      'new File([' + this.serialize(node.f) + '],"' + node.m + '",{type:"' + node.c + '",lastModified:' + node.b + '})',
    );
  }

  private serializeHeaders(
    node: SerovalHeadersNode,
  ): string {
    return this.assignIndexedValue(
      node.i,
      'new Headers(' + this.serializeProperties(node.i, node.e) + ')',
    );
  }

  private serializeFormDataEntries(
    node: SerovalFormDataNode,
  ): string {
    let value: string;
    let key: string;
    const keys = node.e.k;
    const vals = node.e.v;
    const id = node.i;
    let result = '';
    for (let i = 0, len = node.e.s; i < len; i++) {
      if (i !== 0) {
        result += ',';
      }
      key = keys[i];
      value = this.serialize(vals[i]);
      result += this.getRefParam(id) + '.append("' + key + '",' + value + ')';
    }
    return result;
  }

  private serializeFormData(
    node: SerovalFormDataNode,
  ): string {
    const size = node.e.s;
    const id = node.i;
    const result = this.assignIndexedValue(id, 'new FormData()');
    if (size) {
      const entries = this.serializeFormDataEntries(node);
      return '(' + result + ',' + (entries ? entries + ',' : '') + this.getRefParam(id) + ')';
    }
    return result;
  }

  private serializeBoxed(
    node: SerovalBoxedNode,
  ): string {
    return this.assignIndexedValue(node.i, 'Object(' + this.serialize(node.f) + ')');
  }

  private serializePromiseConstructor(
    node: SerovalPromiseConstructorNode,
  ): string {
    return this.assignIndexedValue(node.i, GLOBAL_CONTEXT_API + '.' + GLOBAL_CONTEXT_PROMISE_CONSTRUCTOR + '()');
  }

  private serializePromiseResolve(
    node: SerovalPromiseResolveNode,
  ): string {
    return GLOBAL_CONTEXT_API + '.' + GLOBAL_CONTEXT_PROMISE_RESOLVE + '(' + this.getRefParam(node.i) + ',' + this.serialize(node.f) + ')';
  }

  private serializePromiseReject(
    node: SerovalPromiseRejectNode,
  ): string {
    return GLOBAL_CONTEXT_API + '.' + GLOBAL_CONTEXT_PROMISE_REJECT + '(' + this.getRefParam(node.i) + ',' + this.serialize(node.f) + ')';
  }

  private serializeReadableStreamConstructor(
    node: SerovalReadableStreamConstructorNode,
  ): string {
    return this.assignIndexedValue(node.i, GLOBAL_CONTEXT_API + '.' + GLOBAL_CONTEXT_STREAM_CONSTRUCTOR + '()');
  }

  private serializeReadableStreamEnqueue(
    node: SerovalReadableStreamEnqueueNode,
  ): string {
    return GLOBAL_CONTEXT_API + '.' + GLOBAL_CONTEXT_STREAM_EMIT + '(' + this.getRefParam(node.i) + ',0,' + this.serialize(node.f) + ')';
  }

  private serializeReadableStreamError(
    node: SerovalReadableStreamErrorNode,
  ): string {
    return GLOBAL_CONTEXT_API + '.' + GLOBAL_CONTEXT_STREAM_EMIT + '(' + this.getRefParam(node.i) + ',1,' + this.serialize(node.f) + ')';
  }

  private serializeReadableStreamClose(
    node: SerovalReadableStreamCloseNode,
  ): string {
    return GLOBAL_CONTEXT_API + '.' + GLOBAL_CONTEXT_STREAM_EMIT + '(' + this.getRefParam(node.i) + ',2)';
  }

  private serializeRequest(
    node: SerovalRequestNode,
  ): string {
    return this.assignIndexedValue(node.i, 'new Request("' + node.s + '",' + this.serialize(node.f) + ')');
  }

  private serializeResponse(
    node: SerovalResponseNode,
  ): string {
    return this.assignIndexedValue(
      node.i,
      'new Response(' + this.serialize(node.a[0]) + ',' + this.serialize(node.a[1]) + ')',
    );
  }

  private serializeEvent(
    node: SerovalEventNode,
  ): string {
    return this.assignIndexedValue(
      node.i,
      'new Event("' + node.s + '",' + this.serialize(node.f) + ')',
    );
  }

  private serializeCustomEvent(
    node: SerovalCustomEventNode,
  ): string {
    return this.assignIndexedValue(
      node.i,
      'new CustomEvent("' + node.s + '",' + this.serialize(node.f) + ')',
    );
  }

  private serializeDOMException(
    node: SerovalDOMExceptionNode,
  ): string {
    return this.assignIndexedValue(
      node.i,
      'new DOMException("' + node.s + '","' + node.c + '")',
    );
  }

  private serializePlugin(
    node: SerovalPluginNode,
  ): string {
    if (this.plugins) {
      for (let i = 0, len = this.plugins.length; i < len; i++) {
        const plugin = this.plugins[i];
        if (plugin.tag === node.c) {
          return plugin.serialize(node.s, this, {
            id: node.i,
            isCross: true,
          });
        }
      }
    }
    throw new Error('Missing plugin for tag "' + node.c + '".');
  }

  serialize(node: SerovalNode): string {
    switch (node.t) {
      case SerovalNodeType.Constant:
        return CONSTANT_STRING[node.s];
      case SerovalNodeType.Number:
        return '' + node.s;
      case SerovalNodeType.String:
        return '"' + node.s + '"';
      case SerovalNodeType.BigInt:
        return node.s + 'n';
      case SerovalNodeType.IndexedValue:
        return this.getRefParam(node.i);
      case SerovalNodeType.Reference:
        return this.serializeReference(node);
      case SerovalNodeType.Array:
        return this.serializeArray(node);
      case SerovalNodeType.Object:
        return this.serializeObject(node);
      case SerovalNodeType.NullConstructor:
        return this.serializeNullConstructor(node);
      case SerovalNodeType.Date:
        return this.serializeDate(node);
      case SerovalNodeType.RegExp:
        return this.serializeRegExp(node);
      case SerovalNodeType.Set:
        return this.serializeSet(node);
      case SerovalNodeType.Map:
        return this.serializeMap(node);
      case SerovalNodeType.ArrayBuffer:
        return this.serializeArrayBuffer(node);
      case SerovalNodeType.BigIntTypedArray:
      case SerovalNodeType.TypedArray:
        return this.serializeTypedArray(node);
      case SerovalNodeType.DataView:
        return this.serializeDataView(node);
      case SerovalNodeType.AggregateError:
        return this.serializeAggregateError(node);
      case SerovalNodeType.Error:
        return this.serializeError(node);
      case SerovalNodeType.Promise:
        return this.serializePromise(node);
      case SerovalNodeType.WKSymbol:
        return this.serializeWKSymbol(node);
      case SerovalNodeType.URL:
        return this.serializeURL(node);
      case SerovalNodeType.URLSearchParams:
        return this.serializeURLSearchParams(node);
      case SerovalNodeType.Blob:
        return this.serializeBlob(node);
      case SerovalNodeType.File:
        return this.serializeFile(node);
      case SerovalNodeType.Headers:
        return this.serializeHeaders(node);
      case SerovalNodeType.FormData:
        return this.serializeFormData(node);
      case SerovalNodeType.Boxed:
        return this.serializeBoxed(node);
      case SerovalNodeType.PromiseConstructor:
        return this.serializePromiseConstructor(node);
      case SerovalNodeType.PromiseResolve:
        return this.serializePromiseResolve(node);
      case SerovalNodeType.PromiseReject:
        return this.serializePromiseReject(node);
      case SerovalNodeType.ReadableStreamConstructor:
        return this.serializeReadableStreamConstructor(node);
      case SerovalNodeType.ReadableStreamEnqueue:
        return this.serializeReadableStreamEnqueue(node);
      case SerovalNodeType.ReadableStreamError:
        return this.serializeReadableStreamError(node);
      case SerovalNodeType.ReadableStreamClose:
        return this.serializeReadableStreamClose(node);
      case SerovalNodeType.Request:
        return this.serializeRequest(node);
      case SerovalNodeType.Response:
        return this.serializeResponse(node);
      case SerovalNodeType.Event:
        return this.serializeEvent(node);
      case SerovalNodeType.CustomEvent:
        return this.serializeCustomEvent(node);
      case SerovalNodeType.DOMException:
        return this.serializeDOMException(node);
      case SerovalNodeType.Plugin:
        return this.serializePlugin(node);
      default:
        throw new Error('invariant');
    }
  }
}
