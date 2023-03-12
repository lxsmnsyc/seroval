import { PrimitiveValue } from './types';

export default function isPrimitive(current: unknown): current is PrimitiveValue {
  if (!current || current === true) {
    return true;
  }
  const type = typeof current;
  const classConst = current.constructor;
  return type === 'number'
    || type === 'string'
    || type === 'bigint'
    || classConst === Date;
}
