import { SerovalObjectFlags } from '../constants';

export function getObjectFlag(obj: unknown): SerovalObjectFlags {
  // Extensible objects can be neither sealed nor frozen, so the common case
  // needs a single native call.
  if (Object.isExtensible(obj)) {
    return SerovalObjectFlags.None;
  }
  if (Object.isFrozen(obj)) {
    return SerovalObjectFlags.Frozen;
  }
  if (Object.isSealed(obj)) {
    return SerovalObjectFlags.Sealed;
  }
  return SerovalObjectFlags.NonExtensible;
}
