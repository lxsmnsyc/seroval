import {
  SERIALIZED_PROMISE_CONSTRUCTOR,
  SERIALIZED_PROMISE_FAILURE,
  SERIALIZED_PROMISE_SUCCESS,
  SERIALIZED_STREAM_CONSTRUCTOR,
} from './constructors';

export const ITERATOR = {};

export const ASYNC_ITERATOR = {};

export const enum SpecialReference {
  MapSentinel = 0,
  PromiseConstructor = 1,
  PromiseSuccess = 2,
  PromiseFailure = 3,
  StreamConstructor = 4,
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
};

export function serializeSpecialReferenceValue(ref: SpecialReference): string {
  switch (ref) {
    case SpecialReference.MapSentinel:
      return '[]';
    case SpecialReference.PromiseConstructor:
      return SERIALIZED_PROMISE_CONSTRUCTOR;
    case SpecialReference.PromiseSuccess:
      return SERIALIZED_PROMISE_SUCCESS;
    case SpecialReference.PromiseFailure:
      return SERIALIZED_PROMISE_FAILURE;
    case SpecialReference.StreamConstructor:
      return SERIALIZED_STREAM_CONSTRUCTOR;
    default:
      return '';
  }
}
