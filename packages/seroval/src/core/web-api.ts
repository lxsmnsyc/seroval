import { SerovalNodeType } from './constants';
import { serializeString } from './string';
import type {
  SerovalDOMExceptionNode,
  SerovalNode,
} from './types';

export function createDOMExceptionNode(
  id: number,
  current: DOMException,
): SerovalDOMExceptionNode {
  return {
    t: SerovalNodeType.DOMException,
    i: id,
    s: serializeString(current.message),
    l: undefined,
    c: serializeString(current.name),
    m: undefined,
    p: undefined,
    e: undefined,
    a: undefined,
    f: undefined,
    b: undefined,
    o: undefined,
  };
}

