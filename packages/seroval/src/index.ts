import { serialize } from './core/tree';

export type {
  AsyncServerValue,
  ServerValue,
  PrimitiveValue,
  CommonServerValue,
  SemiPrimitiveValue,
  ErrorValue,
} from './types';
export { Feature } from './core/compat';
export { createReference } from './core/reference';

export * from './core/tree';
export * from './core/cross';

export { GLOBAL_CONTEXT_API_SCRIPT, getCrossReferenceHeader } from './core/keys';

export { default as Serializer } from './core/Serializer';

export default serialize;
