export const UNIVERSAL_SENTINEL = {};

export const ITERATOR = {};

export const ASYNC_ITERATOR = {};

export const enum SpecialReference {
  MapSentinel = 0,
  PromiseConstructor = 2,
  PromiseResolve = 3,
  PromiseReject = 4,
  StreamConstructor = 9,
}

export const SPECIAL_REFS: Record<SpecialReference, unknown> = {
  [SpecialReference.MapSentinel]: {},
  [SpecialReference.PromiseConstructor]: {},
  [SpecialReference.PromiseResolve]: {},
  [SpecialReference.PromiseReject]: {},
  [SpecialReference.StreamConstructor]: {},
};
