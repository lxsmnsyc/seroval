export default function createIterator<T>(
  values: Array<T>,
): Iterator<T> {
  let index = 0;
  const len = values.length;
  return {
    next() {
      return {
        value: values[index++],
        done: index >= len,
      };
    },
  };
}
