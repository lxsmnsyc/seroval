import { SerovalNodeType } from './constants';
import { serializeString } from './string';
import type { SerovalDOMExceptionNode, SerovalURLNode, SerovalURLSearchParamsNode } from './types';

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
