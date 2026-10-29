import { describe, expect, it } from 'vitest';
import {
  Feature,
  compileJSON,
  crossSerialize,
  deserialize,
  fromCrossJSON,
  fromJSON,
  serialize,
  toCrossJSON,
  toJSON,
} from '../src';

// Runs the cross output the way a page would: `$R` holds the references.
function evaluateCross<T>(source: string): T {
  // oxlint-disable-next-line no-new-func, no-implied-eval, no-unsafe-call -- The test runs output it just produced.
  return new Function('$R', `return ${source}`)([]) as T;
}

const DECODERS: [string, <T>(value: T, disabledFeatures?: number) => T][] = [
  ['serialize', (value, disabledFeatures) => deserialize(serialize(value, { disabledFeatures }))],
  [
    'compileJSON',
    (value, disabledFeatures) => deserialize(compileJSON(toJSON(value, { disabledFeatures }))),
  ],
  ['fromJSON', (value, disabledFeatures) => fromJSON(toJSON(value, { disabledFeatures }))],
  [
    'crossSerialize',
    (value, disabledFeatures) => evaluateCross(crossSerialize(value, { disabledFeatures })),
  ],
  [
    'fromCrossJSON',
    (value, disabledFeatures) =>
      fromCrossJSON(toCrossJSON(value, { disabledFeatures }), { refs: new Map() }),
  ],
];

function defineOwnProto(target: object, value: unknown): void {
  Object.defineProperty(target, '__proto__', {
    value,
    configurable: true,
    enumerable: true,
    writable: true,
  });
}

describe.each(DECODERS)('%s', (_name, roundTrip) => {
  // A falsy `constructor` value once made the parser treat the object as one
  // with a null prototype.
  it.each([undefined, null, 0, '', false])(
    'keeps Object.prototype for { constructor: %s }',
    (constructor) => {
      const back = roundTrip({ constructor, a: 1 });
      expect(Object.getPrototypeOf(back)).toBe(Object.prototype);
      expect(Object.keys(back)).toEqual(['constructor', 'a']);
      expect(back.constructor).toBe(constructor);
    },
  );

  it('keeps a null prototype', () => {
    const source = Object.assign(Object.create(null) as object, { a: 1 });
    expect(Object.getPrototypeOf(roundTrip(source))).toBe(null);
  });

  // An object built through separate assignments once chained equal value
  // expressions, so `h.b=h.a=new Set` made both keys share one Set.
  it.each([
    ['a null prototype and an own __proto__', 0],
    ['Object.assign disabled', Feature.ObjectAssign],
  ])('keeps separate values separate with %s', (_label, disabledFeatures) => {
    const source = Object.create(null) as Record<string, unknown>;
    source.a = new Set();
    source.b = new Set();
    source.c = {};
    source.d = {};
    if (!disabledFeatures) {
      defineOwnProto(source, 1);
    }
    const back = roundTrip(source, disabledFeatures);
    expect(back.a).toBeInstanceOf(Set);
    expect(back.a).not.toBe(back.b);
    expect(back.c).not.toBe(back.d);
    expect(back.c).toEqual({});
  });

  it('keeps shared values shared with an own __proto__', () => {
    const shared = new Set();
    const source = Object.create(null) as Record<string, unknown>;
    source.a = shared;
    source.b = shared;
    defineOwnProto(source, 1);
    const back = roundTrip(source);
    expect(back.a).toBeInstanceOf(Set);
    expect(back.a).toBe(back.b);
  });
});
