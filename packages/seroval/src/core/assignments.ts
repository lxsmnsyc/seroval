import { SerovalObjectFlags } from './constants';

interface IndexAssignment {
  t: 'index';
  s: string;
  k: undefined;
  v: string;
}

interface SetAssignment {
  t: 'set';
  s: string;
  k: string;
  v: string;
}

interface AddAssignment {
  t: 'add';
  s: string;
  k: undefined;
  v: string;
}

interface AppendAssignment {
  t: 'append';
  s: string;
  k: string;
  v: string;
}

// Array of assignments to be done (used for recursion)
export type Assignment =
  | IndexAssignment
  | AddAssignment
  | SetAssignment
  | AppendAssignment;

export interface FlaggedObject {
  type: SerovalObjectFlags;
  value: string;
}

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

export function resolveAssignments(assignments: Assignment[]): string | undefined {
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

export function resolveFlags(flags: FlaggedObject[]): string | undefined {
  let result = '';
  for (let i = 0, len = flags.length; i < len; i++) {
    const flag = flags[i];
    result += OBJECT_FLAG_CONSTRUCTOR[flag.type] + '(' + flag.value + '),';
  }
  return result;
}
