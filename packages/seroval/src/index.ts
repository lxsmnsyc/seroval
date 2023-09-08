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

export default serialize;
