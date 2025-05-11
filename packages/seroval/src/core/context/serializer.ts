import { Feature } from '../compat';
import {
  CONSTANT_STRING,
  ERROR_CONSTRUCTOR_STRING,
  NIL,
  SYMBOL_STRING,
  SerovalNodeType,
  SerovalObjectFlags,
} from '../constants';
import {
  SerovalMissingPluginError,
  SerovalSerializationError,
  SerovalUnsupportedNodeError,
} from '../errors';
import { createEffectfulFunction, createFunction } from '../function-string';
import { REFERENCES_KEY } from '../keys';
import type { Plugin, PluginAccessOptions, SerovalMode } from '../plugin';
import { serializeSpecialReferenceValue } from '../special-reference';
import type {
  SerovalAggregateErrorNode,
  SerovalArrayBufferNode,
  SerovalArrayNode,
  SerovalAsyncIteratorFactoryInstanceNode,
  SerovalAsyncIteratorFactoryNode,
  SerovalBigIntTypedArrayNode,
  SerovalBoxedNode,
  SerovalDataViewNode,
  SerovalDateNode,
  SerovalErrorNode,
  SerovalIndexedValueNode,
  SerovalIteratorFactoryInstanceNode,
  SerovalIteratorFactoryNode,
  SerovalMapNode,
  SerovalNode,
  SerovalNodeWithID,
  SerovalNullConstructorNode,
  SerovalObjectNode,
  SerovalObjectRecordKey,
  SerovalObjectRecordNode,
  SerovalPluginNode,
  SerovalPromiseConstructorNode,
  SerovalPromiseNode,
  SerovalPromiseRejectNode,
  SerovalPromiseResolveNode,
  SerovalReferenceNode,
  SerovalRegExpNode,
  SerovalSetNode,
  SerovalSpecialReferenceNode,
  SerovalStreamConstructorNode,
  SerovalStreamNextNode,
  SerovalStreamReturnNode,
  SerovalStreamThrowNode,
  SerovalTypedArrayNode,
  SerovalWKSymbolNode,
} from '../types';
import { isValidIdentifier } from '../utils/is-valid-identifier';

const enum AssignmentType {
  Index = 0,
  Add = 1,
  Set = 2,
  Delete = 3,
}

interface IndexAssignment {
  t: AssignmentType.Index;
  s: string;
  k: undefined;
  v: string;
}

interface SetAssignment {
  t: AssignmentType.Set;
  s: string;
  k: string;
  v: string;
}

interface AddAssignment {
  t: AssignmentType.Add;
  s: string;
  k: undefined;
  v: string;
}

interface DeleteAssignment {
  t: AssignmentType.Delete;
  s: string;
  k: string;
  v: undefined;
}

// Array of assignments to be done (used for recursion)
type Assignment =
  | IndexAssignment
  | AddAssignment
  | SetAssignment
  | DeleteAssignment;

export interface FlaggedObject {
  type: SerovalObjectFlags;
  value: string;
}

function getAssignmentExpression(assignment: Assignment): string {
  switch (assignment.t) {
    case AssignmentType.Index:
      return assignment.s + '=' + assignment.v;
    case AssignmentType.Set:
      return assignment.s + '.set(' + assignment.k + ',' + assignment.v + ')';
    case AssignmentType.Add:
      return assignment.s + '.add(' + assignment.v + ')';
    case AssignmentType.Delete:
      return assignment.s + '.delete(' + assignment.k + ')';
  }
}

function mergeAssignments(assignments: Assignment[]): Assignment[] {
  const newAssignments: Assignment[] = [];
  let current = assignments[0];
  for (
    let i = 1, len = assignments.length, item: Assignment, prev = current;
    i < len;
    i++
  ) {
    item = assignments[i];
    if (item.t === AssignmentType.Index && item.v === prev.v) {
      // Merge if the right-hand value is the same
      // saves at least 2 chars
      current = {
        t: AssignmentType.Index,
        s: item.s,
        k: NIL,
        v: getAssignmentExpression(current),
      } as IndexAssignment;
    } else if (item.t === AssignmentType.Set && item.s === prev.s) {
      // Maps has chaining methods, merge if source is the same
      current = {
        t: AssignmentType.Set,
        s: getAssignmentExpression(current),
        k: item.k,
        v: item.v,
      } as SetAssignment;
    } else if (item.t === AssignmentType.Add && item.s === prev.s) {
      // Sets has chaining methods too
      current = {
        t: AssignmentType.Add,
        s: getAssignmentExpression(current),
        k: NIL,
        v: item.v,
      } as AddAssignment;
    } else if (item.t === AssignmentType.Delete && item.s === prev.s) {
      // Maps has chaining methods, merge if source is the same
      current = {
        t: AssignmentType.Delete,
        s: getAssignmentExpression(current),
        k: item.k,
        v: NIL,
      } as DeleteAssignment;
    } else {
      // Different assignment, push current
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
  return NIL;
}

const NULL_CONSTRUCTOR = 'Object.create(null)';
const SET_CONSTRUCTOR = 'new Set';
const MAP_CONSTRUCTOR = 'new Map';

const PROMISE_RESOLVE = 'Promise.resolve';
const PROMISE_REJECT = 'Promise.reject';

const OBJECT_FLAG_CONSTRUCTOR: Record<SerovalObjectFlags, string | undefined> =
  {
    [SerovalObjectFlags.Frozen]: 'Object.freeze',
    [SerovalObjectFlags.Sealed]: 'Object.seal',
    [SerovalObjectFlags.NonExtensible]: 'Object.preventExtensions',
    [SerovalObjectFlags.None]: NIL,
  };

type SerovalNodeWithProperties =
  | SerovalObjectNode
  | SerovalNullConstructorNode
  | SerovalAggregateErrorNode
  | SerovalErrorNode;

export interface BaseSerializerContextOptions extends PluginAccessOptions {
  features: number;
  markedRefs: number[] | Set<number>;
}

export default abstract class BaseSerializerContext
  implements PluginAccessOptions
{
  /**
   * @private
   */
  features: number;

  /**
   * To check if an object is synchronously referencing itself
   * @private
   */
  stack: number[] = [];

  /**
   * Array of object mutations
   * @private
   */
  flags: FlaggedObject[] = [];

  /**
   * Array of assignments to be done (used for recursion)
   * @private
   */
  assignments: Assignment[] = [];

  plugins?: Plugin<any, any>[] | undefined;

  /**
   * Refs that are...referenced
   * @private
   */
  marked: Set<number>;

  constructor(options: BaseSerializerContextOptions) {
    this.plugins = options.plugins;
    this.features = options.features;
    this.marked = new Set(options.markedRefs);
  }

  abstract readonly mode: SerovalMode;

  createFunction(parameters: string[], body: string): string {
    return createFunction(this.features, parameters, body);
  }

  createEffectfulFunction(parameters: string[], body: string): string {
    return createEffectfulFunction(this.features, parameters, body);
  }

  /**
   * A tiny function that tells if a reference
   * is to be accessed. This is a requirement for
   * deciding whether or not we should generate
   * an identifier for the object
   */
  protected markRef(id: number): void {
    this.marked.add(id);
  }

  protected isMarked(id: number): boolean {
    return this.marked.has(id);
  }

  /**
   * Converts the ID of a reference into a identifier string
   * that is used to refer to the object instance in the
   * generated script.
   */
  abstract getRefParam(id: number): string;

  protected pushObjectFlag(flag: SerovalObjectFlags, id: number): void {
    if (flag !== SerovalObjectFlags.None) {
      this.markRef(id);
      this.flags.push({
        type: flag,
        value: this.getRefParam(id),
      });
    }
  }

  private resolveFlags(): string | undefined {
    let result = '';
    for (let i = 0, current = this.flags, len = current.length; i < len; i++) {
      const flag = current[i];
      result += OBJECT_FLAG_CONSTRUCTOR[flag.type] + '(' + flag.value + '),';
    }
    return result;
  }

  protected resolvePatches(): string | undefined {
    const assignments = resolveAssignments(this.assignments);
    const flags = this.resolveFlags();
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
  protected createAssignment(source: string, value: string): void {
    this.assignments.push({
      t: AssignmentType.Index,
      s: source,
      k: NIL,
      v: value,
    });
  }

  protected createAddAssignment(ref: number, value: string): void {
    this.assignments.push({
      t: AssignmentType.Add,
      s: this.getRefParam(ref),
      k: NIL,
      v: value,
    });
  }

  protected createSetAssignment(ref: number, key: string, value: string): void {
    this.assignments.push({
      t: AssignmentType.Set,
      s: this.getRefParam(ref),
      k: key,
      v: value,
    });
  }

  protected createDeleteAssignment(ref: number, key: string): void {
    this.assignments.push({
      t: AssignmentType.Delete,
      s: this.getRefParam(ref),
      k: key,
      v: NIL,
    });
  }

  protected createArrayAssign(
    ref: number,
    index: number | string,
    value: string,
  ): void {
    this.createAssignment(this.getRefParam(ref) + '[' + index + ']', value);
  }

  protected createObjectAssign(ref: number, key: string, value: string): void {
    this.createAssignment(this.getRefParam(ref) + '.' + key, value);
  }

  /**
   * Checks if the value is in the stack. Stack here is a reference
   * structure to know if a object is to be accessed in a TDZ.
   */
  isIndexedValueInStack(node: SerovalNode): boolean {
    return (
      node.t === SerovalNodeType.IndexedValue && this.stack.includes(node.i)
    );
  }

  /**
   * Produces an assignment expression. `id` generates a reference
   * parameter (through `getRefParam`) and has the option to
   * return the reference parameter directly or assign a value to
   * it.
   */
  protected abstract assignIndexedValue(id: number, value: string): string;

  protected serializeReference(node: SerovalReferenceNode): string {
    return this.assignIndexedValue(
      node.i,
      REFERENCES_KEY + '.get("' + node.s + '")',
    );
  }

  protected serializeArrayItem(
    id: number,
    item: SerovalNode | undefined,
    index: number,
  ): string {
    // Check if index is a hole
    if (item) {
      // Check if item is a parent
      if (this.isIndexedValueInStack(item)) {
        this.markRef(id);
        this.createArrayAssign(
          id,
          index,
          this.getRefParam((item as SerovalIndexedValueNode).i),
        );
        return '';
      }
      return this.serialize(item);
    }
    return '';
  }

  protected serializeArray(node: SerovalArrayNode): string {
    const id = node.i;
    if (node.l) {
      this.stack.push(id);
      const list = node.a;
      let values = this.serializeArrayItem(id, list[0], 0);
      // This is different than Map and Set
      // because we also need to serialize
      // the holes of the Array
      let isHoley = values === '';
      for (let i = 1, len = node.l, item: string; i < len; i++) {
        item = this.serializeArrayItem(id, list[i], i);
        values += ',' + item;
        isHoley = item === '';
      }
      this.stack.pop();
      this.pushObjectFlag(node.o, node.i);
      return this.assignIndexedValue(id, '[' + values + (isHoley ? ',]' : ']'));
    }
    return this.assignIndexedValue(id, '[]');
  }

  protected serializeProperty(
    source: SerovalNodeWithProperties,
    key: SerovalObjectRecordKey,
    val: SerovalNode,
  ): string {
    if (typeof key === 'string') {
      const check = Number(key);
      const isIdentifier =
        // Test if key is a valid positive number or JS identifier
        // so that we don't have to serialize the key and wrap with brackets
        (check >= 0 &&
          // It's also important to consider that if the key is
          // indeed numeric, we need to make sure that when
          // converted back into a string, it's still the same
          // to the original key. This allows us to differentiate
          // keys that has numeric formats but in a different
          // format, which can cause unintentional key declaration
          // Example: { 0x1: 1 } vs { '0x1': 1 }
          check.toString() === key) ||
        isValidIdentifier(key);
      if (this.isIndexedValueInStack(val)) {
        const refParam = this.getRefParam((val as SerovalIndexedValueNode).i);
        this.markRef(source.i);
        // Strict identifier check, make sure
        // that it isn't numeric (except NaN)
        if (isIdentifier && check !== check) {
          this.createObjectAssign(source.i, key, refParam);
        } else {
          this.createArrayAssign(
            source.i,
            isIdentifier ? key : '"' + key + '"',
            refParam,
          );
        }
        return '';
      }
      return (isIdentifier ? key : '"' + key + '"') + ':' + this.serialize(val);
    }
    return '[' + this.serialize(key) + ']:' + this.serialize(val);
  }

  protected serializeProperties(
    source: SerovalNodeWithProperties,
    record: SerovalObjectRecordNode,
  ): string {
    const len = record.s;
    if (len) {
      const keys = record.k;
      const values = record.v;
      this.stack.push(source.i);
      let result = this.serializeProperty(source, keys[0], values[0]);
      for (let i = 1, item = result; i < len; i++) {
        item = this.serializeProperty(source, keys[i], values[i]);
        result += (item && result && ',') + item;
      }
      this.stack.pop();
      return '{' + result + '}';
    }
    return '{}';
  }

  protected serializeObject(node: SerovalObjectNode): string {
    this.pushObjectFlag(node.o, node.i);
    return this.assignIndexedValue(
      node.i,
      this.serializeProperties(node, node.p),
    );
  }

  protected serializeWithObjectAssign(
    source: SerovalNodeWithProperties,
    value: SerovalObjectRecordNode,
    serialized: string,
  ): string {
    const fields = this.serializeProperties(source, value);
    if (fields !== '{}') {
      return 'Object.assign(' + serialized + ',' + fields + ')';
    }
    return serialized;
  }

  private serializeStringKeyAssignment(
    source: SerovalNodeWithProperties,
    mainAssignments: Assignment[],
    key: string,
    value: SerovalNode,
  ): void {
    const serialized = this.serialize(value);
    const check = Number(key);
    const isIdentifier =
      // Test if key is a valid positive number or JS identifier
      // so that we don't have to serialize the key and wrap with brackets
      (check >= 0 &&
        // It's also important to consider that if the key is
        // indeed numeric, we need to make sure that when
        // converted back into a string, it's still the same
        // to the original key. This allows us to differentiate
        // keys that has numeric formats but in a different
        // format, which can cause unintentional key declaration
        // Example: { 0x1: 1 } vs { '0x1': 1 }
        check.toString() === key) ||
      isValidIdentifier(key);
    if (this.isIndexedValueInStack(value)) {
      // Strict identifier check, make sure
      // that it isn't numeric (except NaN)
      if (isIdentifier && check !== check) {
        this.createObjectAssign(source.i, key, serialized);
      } else {
        this.createArrayAssign(
          source.i,
          isIdentifier ? key : '"' + key + '"',
          serialized,
        );
      }
    } else {
      const parentAssignment = this.assignments;
      this.assignments = mainAssignments;
      if (isIdentifier && check !== check) {
        this.createObjectAssign(source.i, key, serialized);
      } else {
        this.createArrayAssign(
          source.i,
          isIdentifier ? key : '"' + key + '"',
          serialized,
        );
      }
      this.assignments = parentAssignment;
    }
  }

  protected serializeAssignment(
    source: SerovalNodeWithProperties,
    mainAssignments: Assignment[],
    key: SerovalObjectRecordKey,
    value: SerovalNode,
  ): void {
    if (typeof key === 'string') {
      this.serializeStringKeyAssignment(source, mainAssignments, key, value);
    } else {
      const parent = this.stack;
      this.stack = [];
      const serialized = this.serialize(value);
      this.stack = parent;
      const parentAssignment = this.assignments;
      this.assignments = mainAssignments;
      this.createArrayAssign(source.i, this.serialize(key), serialized);
      this.assignments = parentAssignment;
    }
  }

  protected serializeAssignments(
    source: SerovalNodeWithProperties,
    node: SerovalObjectRecordNode,
  ): string | undefined {
    const len = node.s;
    if (len) {
      const mainAssignments: Assignment[] = [];
      const keys = node.k;
      const values = node.v;
      this.stack.push(source.i);
      for (let i = 0; i < len; i++) {
        this.serializeAssignment(source, mainAssignments, keys[i], values[i]);
      }
      this.stack.pop();
      return resolveAssignments(mainAssignments);
    }
    return NIL;
  }

  protected serializeDictionary(
    node: SerovalNodeWithProperties,
    init: string,
  ): string {
    if (node.p) {
      if (this.features & Feature.ObjectAssign) {
        init = this.serializeWithObjectAssign(node, node.p, init);
      } else {
        this.markRef(node.i);
        const assignments = this.serializeAssignments(node, node.p);
        if (assignments) {
          return (
            '(' +
            this.assignIndexedValue(node.i, init) +
            ',' +
            assignments +
            this.getRefParam(node.i) +
            ')'
          );
        }
      }
    }
    return this.assignIndexedValue(node.i, init);
  }

  protected serializeNullConstructor(node: SerovalNullConstructorNode): string {
    this.pushObjectFlag(node.o, node.i);
    return this.serializeDictionary(node, NULL_CONSTRUCTOR);
  }

  protected serializeDate(node: SerovalDateNode): string {
    return this.assignIndexedValue(node.i, 'new Date("' + node.s + '")');
  }

  protected serializeRegExp(node: SerovalRegExpNode): string {
    return this.assignIndexedValue(node.i, '/' + node.c + '/' + node.m);
  }

  protected serializeSetItem(id: number, item: SerovalNode): string {
    if (this.isIndexedValueInStack(item)) {
      this.markRef(id);
      this.createAddAssignment(
        id,
        this.getRefParam((item as SerovalIndexedValueNode).i),
      );
      return '';
    }
    return this.serialize(item);
  }

  protected serializeSet(node: SerovalSetNode): string {
    let serialized = SET_CONSTRUCTOR;
    const size = node.l;
    const id = node.i;
    if (size) {
      const items = node.a;
      this.stack.push(id);
      let result = this.serializeSetItem(id, items[0]);
      for (let i = 1, item = result; i < size; i++) {
        item = this.serializeSetItem(id, items[i]);
        result += (item && result && ',') + item;
      }
      this.stack.pop();
      if (result) {
        serialized += '([' + result + '])';
      }
    }
    return this.assignIndexedValue(id, serialized);
  }

  protected serializeMapEntry(
    id: number,
    key: SerovalNode,
    val: SerovalNode,
    sentinel: string,
  ): string {
    if (this.isIndexedValueInStack(key)) {
      // Create reference for the map instance
      const keyRef = this.getRefParam((key as SerovalIndexedValueNode).i);
      this.markRef(id);
      // Check if value is a parent
      if (this.isIndexedValueInStack(val)) {
        const valueRef = this.getRefParam((val as SerovalIndexedValueNode).i);
        // Register an assignment since
        // both key and value are a parent of this
        // Map instance
        this.createSetAssignment(id, keyRef, valueRef);
        return '';
      }
      // Reset the stack
      // This is required because the serialized
      // value is no longer part of the expression
      // tree and has been moved to the deferred
      // assignment
      if (
        val.t !== SerovalNodeType.IndexedValue &&
        val.i != null &&
        this.isMarked(val.i)
      ) {
        // We use a trick here using sequence (or comma) expressions
        // basically we serialize the intended object in place WITHOUT
        // actually returning it, this is by returning a placeholder
        // value that we will remove sometime after.
        const serialized =
          '(' + this.serialize(val) + ',[' + sentinel + ',' + sentinel + '])';
        this.createSetAssignment(id, keyRef, this.getRefParam(val.i));
        this.createDeleteAssignment(id, sentinel);
        return serialized;
      }
      const parent = this.stack;
      this.stack = [];
      this.createSetAssignment(id, keyRef, this.serialize(val));
      this.stack = parent;
      return '';
    }
    if (this.isIndexedValueInStack(val)) {
      // Create ref for the Map instance
      const valueRef = this.getRefParam((val as SerovalIndexedValueNode).i);
      this.markRef(id);
      if (
        key.t !== SerovalNodeType.IndexedValue &&
        key.i != null &&
        this.isMarked(key.i)
      ) {
        const serialized =
          '(' + this.serialize(key) + ',[' + sentinel + ',' + sentinel + '])';
        this.createSetAssignment(id, this.getRefParam(key.i), valueRef);
        this.createDeleteAssignment(id, sentinel);
        return serialized;
      }
      // Reset stack for the key serialization
      const parent = this.stack;
      this.stack = [];
      this.createSetAssignment(id, this.serialize(key), valueRef);
      this.stack = parent;
      return '';
    }

    return '[' + this.serialize(key) + ',' + this.serialize(val) + ']';
  }

  protected serializeMap(node: SerovalMapNode): string {
    let serialized = MAP_CONSTRUCTOR;
    const size = node.e.s;
    const id = node.i;
    const sentinel = node.f;
    const sentinelId = this.getRefParam(sentinel.i);
    if (size) {
      const keys = node.e.k;
      const vals = node.e.v;
      this.stack.push(id);
      let result = this.serializeMapEntry(id, keys[0], vals[0], sentinelId);
      for (let i = 1, item = result; i < size; i++) {
        item = this.serializeMapEntry(id, keys[i], vals[i], sentinelId);
        result += (item && result && ',') + item;
      }
      this.stack.pop();
      // Check if there are any values
      // so that the empty Map constructor
      // can be used instead
      if (result) {
        serialized += '([' + result + '])';
      }
    }
    if (sentinel.t === SerovalNodeType.SpecialReference) {
      this.markRef(sentinel.i);
      serialized = '(' + this.serialize(sentinel) + ',' + serialized + ')';
    }
    return this.assignIndexedValue(id, serialized);
  }

  protected serializeArrayBuffer(node: SerovalArrayBufferNode): string {
    let result = 'new Uint8Array(';
    const buffer = node.s;
    const len = buffer.length;
    if (len) {
      result += '[' + buffer[0];
      for (let i = 1; i < len; i++) {
        result += ',' + buffer[i];
      }
      result += ']';
    }
    return this.assignIndexedValue(node.i, result + ').buffer');
  }

  protected serializeTypedArray(
    node: SerovalTypedArrayNode | SerovalBigIntTypedArrayNode,
  ): string {
    return this.assignIndexedValue(
      node.i,
      'new ' +
        node.c +
        '(' +
        this.serialize(node.f) +
        ',' +
        node.b +
        ',' +
        node.l +
        ')',
    );
  }

  protected serializeDataView(node: SerovalDataViewNode): string {
    return this.assignIndexedValue(
      node.i,
      'new DataView(' +
        this.serialize(node.f) +
        ',' +
        node.b +
        ',' +
        node.l +
        ')',
    );
  }

  protected serializeAggregateError(node: SerovalAggregateErrorNode): string {
    const id = node.i;
    // `AggregateError` might've been extended
    // either through class or custom properties
    // Make sure to assign extra properties
    this.stack.push(id);
    const serialized = this.serializeDictionary(
      node,
      'new AggregateError([],"' + node.m + '")',
    );
    this.stack.pop();
    return serialized;
  }

  protected serializeError(node: SerovalErrorNode): string {
    return this.serializeDictionary(
      node,
      'new ' + ERROR_CONSTRUCTOR_STRING[node.s] + '("' + node.m + '")',
    );
  }

  protected serializePromise(node: SerovalPromiseNode): string {
    let serialized: string;
    // Check if resolved value is a parent expression
    const fulfilled = node.f;
    const id = node.i;
    const promiseConstructor = node.s ? PROMISE_RESOLVE : PROMISE_REJECT;
    if (this.isIndexedValueInStack(fulfilled)) {
      // A Promise trick, reference the value
      // inside the `then` expression so that
      // the Promise evaluates after the parent
      // has initialized
      const ref = this.getRefParam((fulfilled as SerovalIndexedValueNode).i);
      serialized =
        promiseConstructor +
        (node.s
          ? '().then(' + this.createFunction([], ref) + ')'
          : '().catch(' +
            this.createEffectfulFunction([], 'throw ' + ref) +
            ')');
    } else {
      this.stack.push(id);
      const result = this.serialize(fulfilled);
      this.stack.pop();
      // just inline the value/reference here
      serialized = promiseConstructor + '(' + result + ')';
    }
    return this.assignIndexedValue(id, serialized);
  }

  protected serializeWellKnownSymbol(node: SerovalWKSymbolNode): string {
    return this.assignIndexedValue(node.i, SYMBOL_STRING[node.s]);
  }

  protected serializeBoxed(node: SerovalBoxedNode): string {
    return this.assignIndexedValue(
      node.i,
      'Object(' + this.serialize(node.f) + ')',
    );
  }

  protected serializePlugin(node: SerovalPluginNode): string {
    const currentPlugins = this.plugins;
    if (currentPlugins) {
      for (let i = 0, len = currentPlugins.length; i < len; i++) {
        const plugin = currentPlugins[i];
        if (plugin.tag === node.c) {
          return this.assignIndexedValue(
            node.i,
            plugin.serialize(node.s, this, {
              id: node.i,
            }),
          );
        }
      }
    }
    throw new SerovalMissingPluginError(node.c);
  }

  private getConstructor(node: SerovalNodeWithID): string {
    const current = this.serialize(node);
    return current === this.getRefParam(node.i) ? current : '(' + current + ')';
  }

  protected serializePromiseConstructor(
    node: SerovalPromiseConstructorNode,
  ): string {
    const resolver = this.assignIndexedValue(node.s, '{p:0,s:0,f:0}');
    return this.assignIndexedValue(
      node.i,
      this.getConstructor(node.f) + '(' + resolver + ')',
    );
  }

  protected serializePromiseResolve(node: SerovalPromiseResolveNode): string {
    return (
      this.getConstructor(node.a[0]) +
      '(' +
      this.getRefParam(node.i) +
      ',' +
      this.serialize(node.a[1]) +
      ')'
    );
  }

  protected serializePromiseReject(node: SerovalPromiseRejectNode): string {
    return (
      this.getConstructor(node.a[0]) +
      '(' +
      this.getRefParam(node.i) +
      ',' +
      this.serialize(node.a[1]) +
      ')'
    );
  }

  protected serializeSpecialReference(
    node: SerovalSpecialReferenceNode,
  ): string {
    return this.assignIndexedValue(
      node.i,
      serializeSpecialReferenceValue(this.features, node.s),
    );
  }

  protected serializeIteratorFactory(node: SerovalIteratorFactoryNode): string {
    let result = '';
    let initialized = false;
    if (node.f.t !== SerovalNodeType.IndexedValue) {
      this.markRef(node.f.i);
      result = '(' + this.serialize(node.f) + ',';
      initialized = true;
    }
    result += this.assignIndexedValue(
      node.i,
      this.createFunction(
        ['s'],
        this.createFunction(
          ['i', 'c', 'd', 't'],
          '(i=0,t={[' +
            this.getRefParam(node.f.i) +
            ']:' +
            this.createFunction([], 't') +
            ',next:' +
            this.createEffectfulFunction(
              [],
              'if(i>s.d)return{done:!0,value:void 0};if(d=s.v[c=i++],c===s.t)throw d;return{done:c===s.d,value:d}',
            ) +
            '})',
        ),
      ),
    );
    if (initialized) {
      result += ')';
    }
    return result;
  }

  protected serializeIteratorFactoryInstance(
    node: SerovalIteratorFactoryInstanceNode,
  ): string {
    return (
      this.getConstructor(node.a[0]) + '(' + this.serialize(node.a[1]) + ')'
    );
  }

  protected serializeAsyncIteratorFactory(
    node: SerovalAsyncIteratorFactoryNode,
  ): string {
    const promise = node.a[0];
    const symbol = node.a[1];

    let result = '';

    if (promise.t !== SerovalNodeType.IndexedValue) {
      this.markRef(promise.i);
      result += '(' + this.serialize(promise);
    }
    if (symbol.t !== SerovalNodeType.IndexedValue) {
      this.markRef(symbol.i);
      result += (result ? ',' : '(') + this.serialize(symbol);
    }
    if (result) {
      result += ',';
    }

    const iterator = this.assignIndexedValue(
      node.i,
      this.createFunction(
        ['s'],
        this.createFunction(
          ['b', 'c', 'p', 'd', 'e', 't', 'f'],
          /**
           * b = resolved values
           * c = b size
           * p = pending promises
           * d = index where the resolved value stops
           * e = if the last value is a throw
           * t = placeholder variable
           * f = finalize
           */
          '(b=[],c=0,p=[],d=-1,e=!1,f=' +
            this.createEffectfulFunction(
              ['i', 'l'],
              'for(i=0,l=p.length;i<l;i++)p[i].s({done:!0,value:void 0})',
            ) +
            ',s.on({next:' +
            this.createEffectfulFunction(
              ['v', 't'],
              'if(t=p.shift())t.s({done:!1,value:v});b.push(v)',
            ) +
            ',throw:' +
            this.createEffectfulFunction(
              ['v', 't'],
              'if(t=p.shift())t.f(v);f(),d=b.length,e=!0,b.push(v)',
            ) +
            ',return:' +
            this.createEffectfulFunction(
              ['v', 't'],
              'if(t=p.shift())t.s({done:!0,value:v});f(),d=b.length,b.push(v)',
            ) +
            '}),t={[' +
            this.getRefParam(symbol.i) +
            ']:' +
            this.createFunction([], 't.p') +
            ',next:' +
            this.createEffectfulFunction(
              ['i', 't', 'v'],
              'if(d===-1){return((i=c++)>=b.length)?(' +
                this.getRefParam(promise.i) +
                '(t={p:0,s:0,f:0}),p.push(t),t.p):{done:!1,value:b[i]}}if(c>d)return{done:!0,value:void 0};if(v=b[i=c++],i!==d)return{done:!1,value:v};if(e)throw v;return{done:!0,value:v}',
            ) +
            '})',
        ),
      ),
    );

    if (result) {
      return result + iterator + ')';
    }

    return iterator;
  }

  protected serializeAsyncIteratorFactoryInstance(
    node: SerovalAsyncIteratorFactoryInstanceNode,
  ): string {
    return (
      this.getConstructor(node.a[0]) + '(' + this.serialize(node.a[1]) + ')'
    );
  }

  protected serializeStreamConstructor(
    node: SerovalStreamConstructorNode,
  ): string {
    const result = this.assignIndexedValue(
      node.i,
      this.getConstructor(node.f) + '()',
    );
    const len = node.a.length;
    if (len) {
      let values = this.serialize(node.a[0]);
      for (let i = 1; i < len; i++) {
        values += ',' + this.serialize(node.a[i]);
      }
      return '(' + result + ',' + values + ',' + this.getRefParam(node.i) + ')';
    }
    return result;
  }

  protected serializeStreamNext(node: SerovalStreamNextNode): string {
    return this.getRefParam(node.i) + '.next(' + this.serialize(node.f) + ')';
  }

  protected serializeStreamThrow(node: SerovalStreamThrowNode): string {
    return this.getRefParam(node.i) + '.throw(' + this.serialize(node.f) + ')';
  }

  protected serializeStreamReturn(node: SerovalStreamReturnNode): string {
    return this.getRefParam(node.i) + '.return(' + this.serialize(node.f) + ')';
  }

  serialize(node: SerovalNode): string {
    try {
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
          return this.serializeWellKnownSymbol(node);
        case SerovalNodeType.Boxed:
          return this.serializeBoxed(node);
        case SerovalNodeType.PromiseConstructor:
          return this.serializePromiseConstructor(node);
        case SerovalNodeType.PromiseSuccess:
          return this.serializePromiseResolve(node);
        case SerovalNodeType.PromiseFailure:
          return this.serializePromiseReject(node);
        case SerovalNodeType.Plugin:
          return this.serializePlugin(node);
        case SerovalNodeType.SpecialReference:
          return this.serializeSpecialReference(node);
        case SerovalNodeType.IteratorFactory:
          return this.serializeIteratorFactory(node);
        case SerovalNodeType.IteratorFactoryInstance:
          return this.serializeIteratorFactoryInstance(node);
        case SerovalNodeType.AsyncIteratorFactory:
          return this.serializeAsyncIteratorFactory(node);
        case SerovalNodeType.AsyncIteratorFactoryInstance:
          return this.serializeAsyncIteratorFactoryInstance(node);
        case SerovalNodeType.StreamConstructor:
          return this.serializeStreamConstructor(node);
        case SerovalNodeType.StreamNext:
          return this.serializeStreamNext(node);
        case SerovalNodeType.StreamThrow:
          return this.serializeStreamThrow(node);
        case SerovalNodeType.StreamReturn:
          return this.serializeStreamReturn(node);
        default:
          throw new SerovalUnsupportedNodeError(node);
      }
    } catch (error) {
      throw new SerovalSerializationError(error);
    }
  }
}
