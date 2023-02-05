import { forEach, join } from './array';
import getIdentifier from './get-identifier';
import quote from './quote';

const EMPTY_SET = 'new Set';
const EMPTY_MAP = 'new Map';
const EMPTY_ARRAY = '[]';

// Values that are non-recursive
export type PrimitiveValue =
  | boolean
  | string
  | number
  | undefined
  | null
  | bigint
  | Date
  | RegExp;

export type ServerValue =
  | PrimitiveValue
  | Array<ServerValue>
  | { [key: string | number]: ServerValue }
  | Set<ServerValue>
  | Map<ServerValue, ServerValue>;

type Assignment = [source: string, value: string];

// Array of assignments to be done (used for recursion)
let ASSIGNMENTS: Assignment[] = [];

// Reference counter
const REF_COUNT = new Map<ServerValue, number>();

// Value-to-ref map
const REFS = new Map<ServerValue, number>();

// Set to check if ref id already has an assigned value
const ASSIGNED_REFS = new Set<number>();

// Variables
let VARS: string[] = [];

// Call lines
let CALLS: string[] = [];

function reset() {
  ASSIGNMENTS = [];
  VARS = [];
  CALLS = [];

  REF_COUNT.clear();
  REFS.clear();
  ASSIGNED_REFS.clear();
}

function resolveAssignments() {
  if (ASSIGNMENTS.length) {
    const result: Record<string, string> = {};

    // Merge all assignments with similar source
    forEach(ASSIGNMENTS, ([source, value]) => {
      if (value in result) {
        result[value] = `${source}=${result[value]}`;
      } else {
        result[value] = `${source}=${value}`;
      }
    });

    return `${join(Object.values(result), ',')},`;
  }
  return '';
}

function insertRef(current: ServerValue) {
  const count = REF_COUNT.get(current) || 0;
  REF_COUNT.set(current, count + 1);
  return count === 0;
}

function constructorCheck<T extends NonNullable<ServerValue>>(
  value: NonNullable<ServerValue>,
  constructor: unknown,
): value is T {
  return value.constructor === constructor;
}

function isPrimitive(current: ServerValue): current is PrimitiveValue {
  if (!current || current === true) {
    return true;
  }
  const type = typeof current;
  const classConst = current.constructor;
  return type === 'number'
    || type === 'string'
    || type === 'bigint'
    || classConst === Date
    || classConst === RegExp;
}

function lookupRefs(current: ServerValue) {
  if (isPrimitive(current)) {
    return;
  }
  if (Array.isArray(current)) {
    if (insertRef(current)) {
      forEach(current, lookupRefs);
    }
  } else if (constructorCheck<Set<ServerValue>>(current, Set)) {
    if (insertRef(current)) {
      for (const item of current.keys()) {
        lookupRefs(item);
      }
    }
  } else if (constructorCheck<Map<ServerValue, ServerValue>>(current, Map)) {
    if (insertRef(current)) {
      for (const [key, value] of current.entries()) {
        lookupRefs(key);
        lookupRefs(value);
      }
    }
  } else if (current.constructor === Object && insertRef(current)) {
    forEach(Object.values(current), lookupRefs);
  }
}

function createRef(value: ServerValue) {
  const current = REFS.get(value);
  if (current != null) {
    return current;
  }
  const id = REFS.size;
  REFS.set(value, id);
  return id;
}

function getRefParam(index: number) {
  if (VARS[index]) {
    return VARS[index];
  }
  const result = getIdentifier(index);
  VARS[index] = result;
  return result;
}

function assignRef(index: number, value: string) {
  return `${getRefParam(index)}=${value}`;
}

function createAssignment(source: string, value: string) {
  ASSIGNMENTS.push([source, value]);
}

function createCall(line: string) {
  CALLS.push(`${line},`);
}

function createSetAdd(ref: number, value: string) {
  createCall(`${getRefParam(ref)}.add(${value})`);
}

function createMapSet(ref: number, key: string, value: string) {
  createCall(`${getRefParam(ref)}.set(${key},${value})`);
}

function createArrayAssign(ref: number, index: number, value: string) {
  createAssignment(`${getRefParam(ref)}[${index}]`, value);
}

function createObjectIdentifierAssign(ref: number, key: string, value: string) {
  createAssignment(`${getRefParam(ref)}.${key}`, value);
}

function createObjectStringAssign(ref: number, key: string, value: string) {
  createAssignment(`${getRefParam(ref)}[${quote(key)}]`, value);
}

function serializePrimitive(value: PrimitiveValue): string {
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
  // negative 0 isn't the same as 0
  if (Object.is(value, -0)) {
    return '-0';
  }
  if (typeof value === 'bigint') {
    return `BigInt("${value}")`;
  }
  if (typeof value === 'string') {
    return quote(value);
  }
  if (value.constructor === Date) {
    return `new Date("${value.toISOString()}")`;
  }
  return String(value);
}

function traverse(current: ServerValue): string | { referred: string } {
  // Skip primitives
  if (isPrimitive(current)) {
    return serializePrimitive(current);
  }
  // Get reference of the current object
  let refResult = REFS.get(current);
  if (refResult != null) {
    // Return the reference if already assigned a value
    if (ASSIGNED_REFS.has(refResult)) {
      return { referred: getRefParam(refResult) };
    }
    // Early sign (to prevent recursion)
    ASSIGNED_REFS.add(refResult);
  }
  // Transform Set
  if (constructorCheck<Set<ServerValue>>(current, Set)) {
    if (current.size) {
      const values: string[] = [];

      for (const value of current.keys()) {
        const result = traverse(value);
        if (typeof result === 'string') {
          values.push(result);
        } else {
          // This object received a ref, we must generate a setter ref
          if (refResult == null) {
            refResult = createRef(current);
          }
          // Received a ref, this might be a recursive ref, defer an assignment
          createSetAdd(refResult, result.referred);
        }
      }

      const value = values.length ? `new Set([${join(values, ',')}])` : EMPTY_SET;
      if (refResult != null) {
        return assignRef(refResult, value);
      }
      return value;
    }
    return EMPTY_SET;
  }
  if (constructorCheck<Map<ServerValue, ServerValue>>(current, Map)) {
    if (current.size) {
      const values: string[] = [];

      for (const [key, value] of current.entries()) {
        const keyResult = traverse(key);
        const valueResult = traverse(value);
        if (typeof keyResult === 'string') {
          if (typeof valueResult === 'string') {
            values.push(`[${keyResult},${valueResult}]`);
          } else {
            if (refResult == null) {
              refResult = createRef(current);
            }
            createMapSet(refResult, keyResult, valueResult.referred);
          }
        } else if (typeof valueResult === 'string') {
          if (refResult == null) {
            refResult = createRef(current);
          }
          createMapSet(refResult, keyResult.referred, valueResult);
        } else {
          if (refResult == null) {
            refResult = createRef(current);
          }
          createMapSet(refResult, keyResult.referred, valueResult.referred);
        }
      }
      const value = values.length ? `new Map([${join(values, ',')}])` : EMPTY_MAP;
      if (refResult != null) {
        return assignRef(refResult, value);
      }
      return value;
    }
    return EMPTY_MAP;
  }
  if (Array.isArray(current)) {
    if (current.length) {
      let values = '';

      forEach(current, (item, i) => {
        if (i in current) {
          const result = traverse(item);
          if (typeof result === 'string') {
            values += result;
            if (i < current.length - 1) {
              values += ',';
            }
          } else {
            if (refResult == null) {
              refResult = createRef(current);
            }
            createArrayAssign(refResult, i, result.referred);
            values += ',';
          }
        } else {
          values += ',';
        }
      });

      const value = `[${values}]`;
      if (refResult != null) {
        return assignRef(refResult, value);
      }
      return value;
    }
    return EMPTY_ARRAY;
  }
  if (current.constructor === Object) {
    const values: string[] = [];

    forEach(Object.entries(current), ([key, value]) => {
      const check = Number(key);
      // Test if key is a valid number or JS identifier
      // so that we don't have to serialize the key and wrap with brackets
      if (Number.isNaN(check) || /^([$A-Z_][0-9A-Z_$]*)$/i.test(key)) {
        const result = traverse(value);
        if (typeof result === 'string') {
          values.push(`${key}:${result}`);
        } else {
          if (refResult == null) {
            refResult = createRef(current);
          }
          createObjectIdentifierAssign(refResult, key, result.referred);
        }
      } else {
        const result = traverse(value);
        if (typeof result === 'string') {
          values.push(`${quote(key)}:${result}`);
        } else {
          if (refResult == null) {
            refResult = createRef(current);
          }
          createObjectStringAssign(refResult, key, result.referred);
        }
      }
    });
    const value = `{${join(values, ',')}}`;
    if (refResult != null) {
      return assignRef(refResult, value);
    }
    return value;
  }
  throw new Error('Unserializable value');
}

export default function serialize(source: ServerValue) {
  if (isPrimitive(source)) {
    return serializePrimitive(source);
  }
  reset();
  // Lookup possible shared references
  lookupRefs(source);
  // Add shared references to refs
  for (const [key, value] of REF_COUNT.entries()) {
    if (value > 1) {
      createRef(key);
    }
  }
  // Get top-level serialization
  const result = traverse(source);
  if (typeof result !== 'string') {
    throw new Error('Unreachable error');
  }

  // Shared references detected
  if (VARS.length) {
    // Get (or create) a ref from the source
    const index = getRefParam(createRef(source));
    const assignments = resolveAssignments();
    const calls = join(CALLS, ',');
    const params = VARS.length > 1
      ? `(${join(VARS, ',')})`
      : VARS[0];
    // Source is probably already assigned
    if (result.startsWith(index)) {
      return `(${params}=>(${result},${assignments}${calls}${index}))()`;
    }
    return `(${params}=>(${index}=${result},${assignments}${calls}${index}))()`;
  }
  if (source.constructor === Object) {
    return `(${result})`;
  }
  return result;
}
