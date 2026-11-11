// Values marked with `transfer`, for the post-message adapter.
const marked = new WeakSet<object>();

/**
 * Marks `value` to move with the message instead of being copied. The marker
 * only has an effect where a value reaches `postMessage` as it is; a value
 * that seroval serializes is copied (see the rpc-endpoint outcome).
 */
export function transfer<T extends object>(value: T): T {
  marked.add(value);
  return value;
}

/** True when `value` was marked with `transfer`. */
export function isTransfer(value: unknown): boolean {
  return typeof value === 'object' && value !== null && marked.has(value);
}
