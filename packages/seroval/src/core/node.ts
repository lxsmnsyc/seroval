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
  // Nodes come in exactly two hidden classes: the leaf `{ t, i, s }` below and
  // the full twelve-field object after it. Leaves (numbers, strings,
  // constants, indexed values, dates, ...) are the bulk of every tree, and the
  // three-field shape is less than half the size of the full one.
  //
  // Invariants that keep the two shapes cheap for V8:
  // - `t`, `i` and `s` sit at the same in-object offsets in both classes, so
  //   the few read sites that see both (the `node.t` dispatch and `node.i`
  //   lookups) are two-way polymorphic, never megamorphic.
  // - Every other field is only read after narrowing on `t`, and a given node
  //   type always has the same shape, so those reads stay monomorphic.
  // - Nodes are never given extra fields after creation; adding one to a leaf
  //   would create a third class.
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
