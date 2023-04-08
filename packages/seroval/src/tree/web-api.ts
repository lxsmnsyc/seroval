import assert from '../assert';
import { Feature } from '../compat';
import { ParserContext } from '../context';
import { SerovalNodeType, SerovalURLNode, SerovalURLSearchParamsNode } from './types';

export function createURLNode(
  ctx: ParserContext,
  id: number,
  current: URL,
): SerovalURLNode {
  assert(ctx.features & Feature.WebAPI, 'Unsupported type "URL"');
  return {
    t: SerovalNodeType.URL,
    i: id,
    s: current.href,
    l: undefined,
    c: undefined,
    m: undefined,
    d: undefined,
    f: undefined,
    a: undefined,
    b: undefined,
  };
}

export function createURLSearchParamsNode(
  ctx: ParserContext,
  id: number,
  current: URLSearchParams,
): SerovalURLSearchParamsNode {
  assert(ctx.features & Feature.WebAPI, 'Unsupported type "URLSearchParams"');
  return {
    t: SerovalNodeType.URLSearchParams,
    i: id,
    s: current.toString(),
    l: undefined,
    c: undefined,
    m: undefined,
    d: undefined,
    f: undefined,
    a: undefined,
    b: undefined,
  };
}
