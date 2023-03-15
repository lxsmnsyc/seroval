/* eslint-disable @typescript-eslint/no-use-before-define */
import { Feature } from '../compat';
import {
  SerializationContext,
  Assignment,
  getRefParam,
  markRef,
} from '../context';
import quote from '../quote';
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
  SerovalReferenceNode,
  SerovalSetNode,
  SerovalTypedArrayNode,
} from './types';

function getAssignmentExpression(assignment: Assignment): string {
  switch (assignment.t) {
    case 'index':
      return `${assignment.s}=${assignment.v}`;
    case 'map':
      return `${assignment.s}.set(${assignment.k},${assignment.v})`;
    case 'set':
      return `${assignment.s}.add(${assignment.v})`;
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
    if (item.t === prev.t) {
      if (item.t === 'index' && item.v === prev.v) {
        // Merge if the right-hand value is the same
        // saves at least 2 chars
        current = {
          t: 'index',
          s: item.s,
          k: undefined,
          v: getAssignmentExpression(current),
        };
      } else if (item.t === 'map' && item.s === prev.s) {
        // Maps has chaining methods, merge if source is the same
        current = {
          t: 'map',
          s: getAssignmentExpression(current),
          k: item.k,
          v: item.v,
        };
      } else if (item.t === 'set' && item.s === prev.s) {
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

export default class SerovalSerializer {
  ctx: SerializationContext;

  constructor(ctx: SerializationContext) {
    this.ctx = ctx;
  }

  assignRef(index: number, value: string) {
    if (this.ctx.markedRefs.has(index)) {
      return `${getRefParam(this.ctx, index)}=${value}`;
    }
    return value;
  }

  isReferenceInStack(
    node: SerovalNode,
  ): node is SerovalReferenceNode {
    return node.t === SerovalNodeType.Reference && this.ctx.stack.includes(node.i);
  }

  serializeNodeList(
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
        if (this.isReferenceInStack(item)) {
          createArrayAssign(this.ctx, node.i, i, getRefParam(this.ctx, item.i));
          values += ',';
        } else {
          values += this.serialize(item);
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

  serializeArray(
    node: SerovalArrayNode,
  ) {
    this.ctx.stack.push(node.i);
    const result = this.serializeNodeList(node);
    this.ctx.stack.pop();
    return this.assignRef(node.i, result);
  }

  serializeObject(
    sourceID: number,
    node: SerovalObjectRecordNode,
  ) {
    if (node.s === 0) {
      return '{}';
    }
    let result = '';
    this.ctx.stack.push(sourceID);
    for (let i = 0; i < node.s; i++) {
      const key = node.k[i];
      const val = node.v[i];
      const check = Number(key);
      // Test if key is a valid number or JS identifier
      // so that we don't have to serialize the key and wrap with brackets
      const isIdentifier = check >= 0 || IDENTIFIER_CHECK.test(key);
      if (this.isReferenceInStack(val)) {
        const refParam = getRefParam(this.ctx, val.i);
        if (isIdentifier && Number.isNaN(check)) {
          createObjectAssign(this.ctx, sourceID, key, refParam);
        } else {
          createArrayAssign(this.ctx, sourceID, isIdentifier ? key : quote(key), refParam);
        }
      } else {
        result += `${isIdentifier ? key : quote(key)}:${this.serialize(val)},`;
      }
    }
    this.ctx.stack.pop();
    return `{${result.substring(0, result.length - 1)}}`;
  }

  serializeWithObjectAssign(
    value: SerovalObjectRecordNode,
    id: number,
    serialized: string,
  ) {
    const fields = this.serializeObject(id, value);
    if (fields !== '{}') {
      return `Object.assign(${serialized},${fields})`;
    }
    return serialized;
  }

  serializeAssignments(
    sourceID: number,
    node: SerovalObjectRecordNode,
  ) {
    this.ctx.stack.push(sourceID);
    const mainAssignments: Assignment[] = [];
    for (let i = 0; i < node.s; i++) {
      const parentStack = this.ctx.stack;
      this.ctx.stack = [];
      const refParam = this.serialize(node.v[i]);
      this.ctx.stack = parentStack;
      const key = node.k[i];
      const check = Number(key);
      const parentAssignment = this.ctx.assignments;
      this.ctx.assignments = mainAssignments;
      // Test if key is a valid number or JS identifier
      // so that we don't have to serialize the key and wrap with brackets
      const isIdentifier = check >= 0 || IDENTIFIER_CHECK.test(key);
      if (isIdentifier && Number.isNaN(check)) {
        createObjectAssign(this.ctx, sourceID, key, refParam);
      } else {
        createArrayAssign(this.ctx, sourceID, isIdentifier ? key : quote(key), refParam);
      }
      this.ctx.assignments = parentAssignment;
    }
    this.ctx.stack.pop();
    return resolveAssignments(mainAssignments);
  }

  serializeNullConstructor(
    node: SerovalNullConstructorNode,
  ) {
    let serialized = 'Object.create(null)';
    if (this.ctx.features & Feature.ObjectAssign) {
      serialized = this.serializeWithObjectAssign(node.d, node.i, serialized);
    } else {
      markRef(this.ctx, node.i);
      const assignments = this.serializeAssignments(node.i, node.d);
      if (assignments) {
        const ref = getRefParam(this.ctx, node.i);
        return `(${this.assignRef(node.i, serialized)},${assignments}${ref})`;
      }
    }
    return this.assignRef(node.i, serialized);
  }

  serializeSet(
    node: SerovalSetNode,
  ) {
    let serialized = 'new Set';
    const size = node.a.length;
    if (size) {
      let result = '';
      this.ctx.stack.push(node.i);
      for (let i = 0; i < size; i++) {
        const item = node.a[i];
        if (this.isReferenceInStack(item)) {
          createSetAdd(this.ctx, node.i, getRefParam(this.ctx, item.i));
        } else {
          // Push directly
          result += `${this.serialize(item)},`;
        }
      }
      this.ctx.stack.pop();
      if (result) {
        serialized += `([${result.substring(0, result.length - 1)}])`;
      }
    }
    return this.assignRef(node.i, serialized);
  }

  serializeMap(
    node: SerovalMapNode,
  ) {
    let serialized = 'new Map';
    if (node.d.s) {
      let result = '';
      this.ctx.stack.push(node.i);
      for (let i = 0; i < node.d.s; i++) {
        // Check if key is a parent
        const key = node.d.k[i];
        const val = node.d.v[i];
        if (this.isReferenceInStack(key)) {
          // Create reference for the map instance
          const keyRef = getRefParam(this.ctx, key.i);
          // Check if value is a parent
          if (this.isReferenceInStack(val)) {
            const valueRef = getRefParam(this.ctx, val.i);
            // Register an assignment since
            // both key and value are a parent of this
            // Map instance
            createMapSet(this.ctx, node.i, keyRef, valueRef);
          } else {
            // Reset the stack
            // This is required because the serialized
            // value is no longer part of the expression
            // tree and has been moved to the deferred
            // assignment
            const parent = this.ctx.stack;
            this.ctx.stack = [];
            createMapSet(this.ctx, node.i, keyRef, this.serialize(val));
            this.ctx.stack = parent;
          }
        } else if (this.isReferenceInStack(val)) {
          // Create ref for the Map instance
          const valueRef = getRefParam(this.ctx, val.i);
          // Reset stack for the key serialization
          const parent = this.ctx.stack;
          this.ctx.stack = [];
          createMapSet(this.ctx, node.i, this.serialize(key), valueRef);
          this.ctx.stack = parent;
        } else {
          result += `[${this.serialize(key)},${this.serialize(val)}],`;
        }
      }
      this.ctx.stack.pop();
      // Check if there are any values
      // so that the empty Map constructor
      // can be used instead
      if (result) {
        serialized += `([${result.substring(0, result.length - 1)}])`;
      }
    }
    return this.assignRef(node.i, serialized);
  }

  serializeAggregateError(
    node: SerovalAggregateErrorNode,
  ) {
    // Serialize the required arguments
    this.ctx.stack.push(node.i);
    let serialized = `new AggregateError(${this.serialize(node.n)},${quote(node.m)})`;
    this.ctx.stack.pop();
    // `AggregateError` might've been extended
    // either through class or custom properties
    // Make sure to assign extra properties
    if (node.d) {
      if (this.ctx.features & Feature.ObjectAssign) {
        serialized = this.serializeWithObjectAssign(node.d, node.i, serialized);
      } else {
        markRef(this.ctx, node.i);
        const assignments = this.serializeAssignments(node.i, node.d);
        if (assignments) {
          const ref = getRefParam(this.ctx, node.i);
          return `(${this.assignRef(node.i, serialized)},${assignments}${ref})`;
        }
      }
    }
    return this.assignRef(node.i, serialized);
  }

  serializeError(
    node: SerovalErrorNode,
  ) {
    let serialized = `new ${node.c}(${quote(node.m)})`;
    if (node.d) {
      if (this.ctx.features & Feature.ObjectAssign) {
        serialized = this.serializeWithObjectAssign(node.d, node.i, serialized);
      } else {
        markRef(this.ctx, node.i);
        const assignments = this.serializeAssignments(node.i, node.d);
        if (assignments) {
          const ref = getRefParam(this.ctx, node.i);
          return `(${this.assignRef(node.i, serialized)},${assignments}${ref})`;
        }
      }
    }
    return this.assignRef(node.i, serialized);
  }

  serializePromise(
    node: SerovalPromiseNode,
  ) {
    let serialized: string;
    // Check if resolved value is a parent expression
    if (this.isReferenceInStack(node.n)) {
      // A Promise trick, reference the value
      // inside the `then` expression so that
      // the Promise evaluates after the parent
      // has initialized
      serialized = `Promise.resolve().then(()=>${getRefParam(this.ctx, node.n.i)})`;
    } else {
      this.ctx.stack.push(node.i);
      const result = this.serialize(node.n);
      this.ctx.stack.pop();
      // just inline the value/reference here
      serialized = `Promise.resolve(${result})`;
    }
    return this.assignRef(node.i, serialized);
  }

  serializeTypedArray(
    node: SerovalTypedArrayNode | SerovalBigIntTypedArrayNode,
  ) {
    let args = `[${node.s}]`;
    if (node.l !== 0) {
      args += `,${node.l}`;
    }
    return this.assignRef(node.i, `new ${node.c}(${args})`);
  }

  serializeIterable(
    node: SerovalIterableNode,
  ) {
    const parent = this.ctx.stack;
    this.ctx.stack = [];
    const values = this.serializeNodeList(node);
    this.ctx.stack = parent;
    let serialized: string;
    if (this.ctx.features & Feature.ArrayPrototypeValues) {
      serialized = `${values}.values()`;
    } else {
      serialized = `${values}[Symbol.iterator]()`;
    }
    if (this.ctx.features & Feature.ArrowFunction) {
      serialized = `{[Symbol.iterator]:()=>${serialized}}`;
    } else if (this.ctx.features & Feature.MethodShorthand) {
      serialized = `{[Symbol.iterator](){return ${serialized}}}`;
    } else {
      serialized = `{[Symbol.iterator]:function(){return ${serialized}}}`;
    }
    if (node.d) {
      if (this.ctx.features & Feature.ObjectAssign) {
        serialized = this.serializeWithObjectAssign(node.d, node.i, serialized);
      } else {
        markRef(this.ctx, node.i);
        const assignments = this.serializeAssignments(node.i, node.d);
        if (assignments) {
          const ref = getRefParam(this.ctx, node.i);
          return `(${this.assignRef(node.i, serialized)},${assignments}${ref})`;
        }
      }
    }
    return this.assignRef(node.i, serialized);
  }

  serialize(node: SerovalNode): string {
    switch (node.t) {
      case SerovalNodeType.Primitive:
        return String(node.s);
      case SerovalNodeType.BigInt:
        return node.s;
      case SerovalNodeType.Reference:
        return getRefParam(this.ctx, node.i);
      case SerovalNodeType.Array:
        return this.serializeArray(node);
      case SerovalNodeType.Object:
        return this.assignRef(node.i, this.serializeObject(node.i, node.d));
      case SerovalNodeType.NullConstructor:
        return this.serializeNullConstructor(node);
      case SerovalNodeType.Date:
        return this.assignRef(node.i, `new Date("${node.s}")`);
      case SerovalNodeType.RegExp:
        return this.assignRef(node.i, node.s);
      case SerovalNodeType.Set:
        return this.serializeSet(node);
      case SerovalNodeType.Map:
        return this.serializeMap(node);
      case SerovalNodeType.BigIntTypedArray:
      case SerovalNodeType.TypedArray:
        return this.serializeTypedArray(node);
      case SerovalNodeType.AggregateError:
        return this.serializeAggregateError(node);
      case SerovalNodeType.Error:
        return this.serializeError(node);
      case SerovalNodeType.Iterable:
        return this.serializeIterable(node);
      case SerovalNodeType.Promise:
        return this.serializePromise(node);
      default:
        throw new Error('Unsupported type');
    }
  }
}
