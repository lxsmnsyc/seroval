export default function assert(cond: unknown, error: string): asserts cond {
  if (!cond) {
    throw new Error(error);
  }
}
