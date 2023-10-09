import { SerovalNodeType } from './constants';
import { serializeString } from './string';
import type { SerovalURLNode, SerovalURLSearchParamsNode } from './types';

export function createURLNode(
  id: number,
  current: URL,
): SerovalURLNode {
  return {
    t: SerovalNodeType.URL,
    i: id,
    s: serializeString(current.href),
    l: undefined,
    c: undefined,
    m: undefined,
    p: undefined,
    e: undefined,
    f: undefined,
    a: undefined,
    b: undefined,
    o: undefined,
  };
}

export function createURLSearchParamsNode(
  id: number,
  current: URLSearchParams,
): SerovalURLSearchParamsNode {
  return {
    t: SerovalNodeType.URLSearchParams,
    i: id,
    s: serializeString(current.toString()),
    l: undefined,
    c: undefined,
    m: undefined,
    p: undefined,
    e: undefined,
    f: undefined,
    a: undefined,
    b: undefined,
    o: undefined,
  };
}
