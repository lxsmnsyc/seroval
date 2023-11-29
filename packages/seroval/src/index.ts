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

export { getCrossReferenceHeader } from './core/keys';

export { default as Serializer } from './core/Serializer';
export * from './core/plugin';

export type { SerovalNode } from './core/types';

export default serialize;
