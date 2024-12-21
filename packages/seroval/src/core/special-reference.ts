export const ITERATOR = {};

export const ASYNC_ITERATOR = {};

export const enum SpecialReference {
  MapSentinel = 0,
  PromiseConstructor = 1,
  PromiseResolve = 2,
  PromiseReject = 3,
  StreamConstructor = 4,
  AbortSignalConstructor = 5,
  AbortSignalAbort = 6,
}

/**
 * Placeholder references
 */
export const SPECIAL_REFS: Record<SpecialReference, unknown> = {
  [SpecialReference.MapSentinel]: {},
  [SpecialReference.PromiseConstructor]: {},
  [SpecialReference.PromiseResolve]: {},
  [SpecialReference.PromiseReject]: {},
  [SpecialReference.StreamConstructor]: {},
  [SpecialReference.AbortSignalConstructor]: {},
  [SpecialReference.AbortSignalAbort]: {},
};
