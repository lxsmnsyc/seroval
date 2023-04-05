import { ParserContext } from '../context';
import { SerovalNodeType, SerovalURLNode } from './types';

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
  };
}
