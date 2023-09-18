export default function assert(cond: unknown, error: Error): asserts cond {
  if (!cond) {
    throw error;
  }
}
