import { SerovalNodeType } from './constants';
import { serializeString } from './string';
import type {
  SerovalCustomEventNode,
  SerovalDOMExceptionNode,
  SerovalEventNode,
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

export function createEventNode(
  id: number,
  type: string,
  options: SerovalNode,
): SerovalEventNode {
  return {
    t: SerovalNodeType.Event,
    i: id,
    s: serializeString(type),
    l: undefined,
    c: undefined,
    m: undefined,
    p: undefined,
    e: undefined,
    a: undefined,
    f: options,
    b: undefined,
    o: undefined,
  };
}

export function createCustomEventNode(
  id: number,
  type: string,
  options: SerovalNode,
): SerovalCustomEventNode {
  return {
    t: SerovalNodeType.CustomEvent,
    i: id,
    s: serializeString(type),
    l: undefined,
    c: undefined,
    m: undefined,
    p: undefined,
    e: undefined,
    a: undefined,
    f: options,
    b: undefined,
    o: undefined,
  };
}
