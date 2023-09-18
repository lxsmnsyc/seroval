import UnsupportedTypeError from './UnsupportedTypeError';
import assert from './assert';
import { Feature } from './compat';
import { SerovalNodeType } from './constants';
import type { BaseParserContext } from './context';
import { serializeString } from './string';
import type { SerovalURLNode, SerovalURLSearchParamsNode } from './types';

export function createURLNode(
  ctx: BaseParserContext,
  id: number,
  current: URL,
): SerovalURLNode {
  assert(ctx.features & Feature.WebAPI, new UnsupportedTypeError(current));
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
  ctx: BaseParserContext,
  id: number,
  current: URLSearchParams,
): SerovalURLSearchParamsNode {
  assert(ctx.features & Feature.WebAPI, new UnsupportedTypeError(current));
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
