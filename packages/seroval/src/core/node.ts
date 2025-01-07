import type { SerovalNodeType } from './constants';
import type { SerovalNode } from './types';

type ExtractedNodeType<T extends SerovalNodeType> = Extract<
  SerovalNode,
  { t: T }
>;

export function createSerovalNode<
  T extends SerovalNodeType,
  N extends ExtractedNodeType<T>,
>(
  t: T,
  i: N['i'],
  s: N['s'],
  l: N['l'],
  c: N['c'],
  m: N['m'],
  p: N['p'],
  e: N['e'],
  a: N['a'],
  f: N['f'],
  b: N['b'],
  o: N['o'],
): N {
  return {
    t,
    i,
    s,
    l,
    c,
    m,
    p,
    e,
    a,
    f,
    b,
    o,
  } as N;
}
