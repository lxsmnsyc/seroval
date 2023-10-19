import { createIndexedValueNode, createReferenceNode } from '../base-primitives';
import { hasReferenceID } from '../reference';
import type { SerovalIndexedValueNode, SerovalReferenceNode } from '../types';

function createIndexedValue<T>(
  ids: Map<unknown, number>,
  marked: Set<number>,
  current: T,
): number {
  const ref = ids.get(current);
  if (ref == null) {
    const id = ids.size;
    ids.set(current, id);
    return id;
  }
  marked.add(ref);
  return ref;
}

export function getVanillaReference<T>(
  ids: Map<unknown, number>,
  marked: Set<number>,
  current: T,
): number | SerovalIndexedValueNode | SerovalReferenceNode {
  const id = createIndexedValue(ids, marked, current);
  if (marked.has(id)) {
    return createIndexedValueNode(id);
  }
  if (hasReferenceID(current)) {
    return createReferenceNode(id, current);
  }
  return id;
}

export function getStrictVanillaReference<T>(
  ids: Map<unknown, number>,
  marked: Set<number>,
  current: T,
): SerovalIndexedValueNode | SerovalReferenceNode {
  const id = createIndexedValue(ids, marked, current);
  if (marked.has(id)) {
    return createIndexedValueNode(id);
  }
  return createReferenceNode(id, current);
}
