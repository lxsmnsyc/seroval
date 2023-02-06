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

// Reference counter
const REF_COUNT = new Map<ServerValue, number>();

const STACK = new Set();

// Value-to-ref map
const REFS = new Map<ServerValue, number>();

// Set to check if ref id already has an assigned value
const ASSIGNED_REFS = new Set<number>();

// Variables
let VARS: string[] = [];

// Array of assignments to be done (used for recursion)
type Assignment = [source: string, value: string];
let ASSIGNMENTS: Assignment[] = [];

// Array of Map.prototype.set calls
type MapSet = [source: string, key: string, value: string];
let MAP_SETS: MapSet[] = [];

// Array of Set.prototype.add calls
type SetAdd = [source: string, value: string];
let SET_ADDS: SetAdd[] = [];

function reset() {
  ASSIGNMENTS = [];
  MAP_SETS = [];
  SET_ADDS = [];
  VARS = [];
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

function resolveMapSets() {
  if (MAP_SETS.length) {
    const result: Record<string, string> = {};

    // Merge all assignments with similar source
    forEach(MAP_SETS, ([source, key, value]) => {
      if (source in result) {
        result[source] = `${result[source]}.set(${key},${value})`;
      } else {
        result[source] = `${source}.set(${key},${value})`;
      }
    });

    return `${join(Object.values(result), ',')},`;
  }
  return '';
}

function resolveSetAdds() {
  if (SET_ADDS.length) {
    const result: Record<string, string> = {};

    // Merge all assignments with similar source
    forEach(SET_ADDS, ([source, value]) => {
      if (source in result) {
        result[source] = `${result[source]}.add(${value})`;
      } else {
        result[source] = `${source}.add(${value})`;
      }
    });

    return `${join(Object.values(result), ',')},`;
  }
  return '';
}

function resolvePatches() {
  return `${resolveAssignments()}${resolveMapSets()}${resolveSetAdds()}`;
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

function createSetAdd(ref: number, value: string) {
  SET_ADDS.push([getRefParam(ref), value]);
}

function createMapSet(ref: number, key: string, value: string) {
  MAP_SETS.push([getRefParam(ref), key, value]);
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

      STACK.add(current);
      for (const value of current.keys()) {
        if (STACK.has(value)) {
          // This object received a ref, we must generate a setter ref
          if (refResult == null) {
            refResult = createRef(current);
          }
          // Received a ref, this might be a recursive ref, defer an assignment
          createSetAdd(refResult, getRefParam(createRef(value)));
        } else {
          const result = traverse(value);
          if (typeof result === 'string') {
            values.push(result);
          } else {
            values.push(result.referred);
          }
        }
      }
      STACK.delete(current);

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

      STACK.add(current);
      for (const [key, value] of current.entries()) {
        if (STACK.has(key)) {
          if (refResult == null) {
            refResult = createRef(current);
          }
          const keyRef = getRefParam(createRef(key));
          if (STACK.has(value)) {
            createMapSet(refResult, keyRef, getRefParam(createRef(value)));
          } else {
            const valueResult = traverse(value);
            if (typeof valueResult === 'string') {
              createMapSet(refResult, keyRef, valueResult);
            } else {
              createMapSet(refResult, keyRef, valueResult.referred);
            }
          }
        } else if (STACK.has(value)) {
          if (refResult == null) {
            refResult = createRef(current);
          }
          const valueRef = getRefParam(createRef(value));
          const keyResult = traverse(key);
          if (typeof keyResult === 'string') {
            createMapSet(refResult, keyResult, valueRef);
          } else {
            createMapSet(refResult, keyResult.referred, valueRef);
          }
        } else {
          const keyResult = traverse(key);
          const valueResult = traverse(value);
          if (typeof keyResult === 'string') {
            if (typeof valueResult === 'string') {
              values.push(`[${keyResult},${valueResult}]`);
            } else {
              values.push(`[${keyResult},${valueResult.referred}]`);
            }
          } else {
            if (typeof valueResult === 'string') {
              values.push(`[${keyResult.referred},${valueResult}]`);
            } else {
              values.push(`[${keyResult.referred},${valueResult.referred}]`);
            }
          }
        }
      }
      STACK.delete(current);
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

      STACK.add(current);
      forEach(current, (item, i) => {
        if (i in current) {
          if (STACK.has(item)) {
            if (refResult == null) {
              refResult = createRef(current);
            }
            createArrayAssign(refResult, i, getRefParam(createRef(item)));
            values += ',';
          } else {
            const result = traverse(item);
            if (typeof result === 'string') {
              values += result;
            } else {
              values += result.referred;
            }
            if (i < current.length - 1) {
              values += ',';
            }
          }
        } else {
          values += ',';
        }
      });
      STACK.delete(current);

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

    STACK.add(current);
    forEach(Object.entries(current), ([key, value]) => {
      const check = Number(key);
      // Test if key is a valid number or JS identifier
      // so that we don't have to serialize the key and wrap with brackets
      if (Number.isNaN(check) || /^([$A-Z_][0-9A-Z_$]*)$/i.test(key)) {
        if (STACK.has(value)) {
          if (refResult == null) {
            refResult = createRef(current);
          }
          createObjectIdentifierAssign(refResult, key, getRefParam(createRef(value)));
        } else {
          const result = traverse(value);
          if (typeof result === 'string') {
            values.push(`${key}:${result}`);
          } else {
            values.push(`${key}:${result.referred}`);
          }
        }
      } else if (STACK.has(value)) {
        if (refResult == null) {
          refResult = createRef(current);
        }
        createObjectStringAssign(refResult, key, getRefParam(createRef(value)));
      } else {
        const result = traverse(value);
        if (typeof result === 'string') {
          values.push(`${quote(key)}:${result}`);
        } else {
          values.push(`${quote(key)}:${result.referred}`);
        }
      }
    });
    STACK.delete(current);

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
    const patches = resolvePatches();
    const params = VARS.length > 1
      ? `(${join(VARS, ',')})`
      : VARS[0];
    // Source is probably already assigned
    if (result.startsWith(index)) {
      return `(${params}=>(${result},${patches}${index}))()`;
    }
    return `(${params}=>(${index}=${result},${patches}${index}))()`;
  }
  if (source.constructor === Object) {
    return `(${result})`;
  }
  return result;
}
