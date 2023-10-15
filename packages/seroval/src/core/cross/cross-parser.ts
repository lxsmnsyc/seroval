import { createIndexedValueNode, createReferenceNode } from '../base-primitives';
import type { BaseParserContextOptions } from '../parser-context';
import { hasReferenceID } from '../reference';
import type { SerovalIndexedValueNode, SerovalReferenceNode } from '../types';

export interface CrossParserContextOptions extends BaseParserContextOptions {
  scopeId?: string;
  refs?: Map<unknown, number>;
}

export function getCrossReference<T>(
  refs: Map<unknown, number>,
  value: T,
): number | SerovalIndexedValueNode | SerovalReferenceNode {
  const registeredID = refs.get(value);
  if (registeredID != null) {
    return createIndexedValueNode(registeredID);
  }
  const id = refs.size;
  refs.set(value, id);
  if (hasReferenceID(value)) {
    return createReferenceNode(id, value);
  }
  return id;
}

export function getStrictCrossReference<T>(
  refs: Map<unknown, number>,
  value: T,
): SerovalIndexedValueNode | SerovalReferenceNode {
  const id = refs.get(value);
  if (id != null) {
    return createIndexedValueNode(id);
  }
  const newID = refs.size;
  refs.set(value, newID);
  return createReferenceNode(newID, value);
}
