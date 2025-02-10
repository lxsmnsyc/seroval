export const ITERATOR = {};

export const ASYNC_ITERATOR = {};

export const enum SpecialReference {
  MapSentinel = 0,
  PromiseConstructor = 1,
  PromiseSuccess = 2,
  PromiseFailure = 3,
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
  [SpecialReference.PromiseSuccess]: {},
  [SpecialReference.PromiseFailure]: {},
  [SpecialReference.StreamConstructor]: {},
  [SpecialReference.AbortSignalConstructor]: {},
  [SpecialReference.AbortSignalAbort]: {},
};
