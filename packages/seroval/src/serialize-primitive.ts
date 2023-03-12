import quote from './quote';
import { PrimitiveValue } from './types';

export default function serializePrimitive(value: PrimitiveValue): string {
  // Shortened forms
  if (value === true) {
    return '!0';
  }
  if (value === false) {
    return '!1';
  }
  if (value === undefined) {
    return 'void 0';
  }
  if (value === null) {
    return 'null';
  }
  // negative 0 isn't the same as 0
  if (Object.is(value, -0)) {
    return '-0';
  }
  if (typeof value === 'bigint') {
    return `BigInt("${value}")`;
  }
  if (typeof value === 'string') {
    return quote(value);
  }
  return String(value);
}
