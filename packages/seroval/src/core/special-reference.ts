export const UNIVERSAL_SENTINEL = {};

export const ITERATOR = {};

export const ASYNC_ITERATOR = {};

export const enum SpecialReference {
  MapSentinel = 0,
  ReadableStream = 1,
  PromiseConstructor = 2,
  PromiseResolve = 3,
  PromiseReject = 4,
  ReadableStreamConstructor = 5,
  ReadableStreamEnqueue = 6,
  ReadableStreamError = 7,
  ReadableStreamClose = 8,
}

export const SPECIAL_REFS: Record<SpecialReference, unknown> = {
  [SpecialReference.MapSentinel]: {},
  [SpecialReference.ReadableStream]: {},
  [SpecialReference.PromiseConstructor]: {},
  [SpecialReference.PromiseResolve]: {},
  [SpecialReference.PromiseReject]: {},
  [SpecialReference.ReadableStreamConstructor]: {},
  [SpecialReference.ReadableStreamEnqueue]: {},
  [SpecialReference.ReadableStreamError]: {},
  [SpecialReference.ReadableStreamClose]: {},
};
