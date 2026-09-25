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
  i?: N['i'],
  s?: N['s'],
  c?: N['c'],
  m?: N['m'],
  p?: N['p'],
  e?: N['e'],
  a?: N['a'],
  f?: N['f'],
  b?: N['b'],
  o?: N['o'],
  l?: N['l'],
): N {
  // Leaves (numbers, strings, constants, indexed values, dates, ...) are the
  // bulk of every tree; a three-field shape keeps them a fraction of the size
  // of the full node while property reads stay polymorphic at two shapes.
  if (
    c === undefined &&
    m === undefined &&
    p === undefined &&
    e === undefined &&
    a === undefined &&
    f === undefined &&
    b === undefined &&
    o === undefined &&
    l === undefined
  ) {
    return { t, i, s } as N;
  }
  return {
    t,
    i,
    s,
    c,
    m,
    p,
    e,
    a,
    f,
    b,
    o,
    l,
  } as N;
}
