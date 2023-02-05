export function forEach<T>(arr: T[], callback: (value: T, index: number) => (boolean | void)) {
  for (let i = 0, len = arr.length; i < len; i++) {
    if (callback(arr[i], i)) {
      break;
    }
  }
}

export function join(arr: string[], joiner: string): string {
  let result = '';
  forEach(arr, (value, index) => {
    result += value;
    if (index < arr.length - 1) {
      result += joiner;
    }
  });
  return result;
}
