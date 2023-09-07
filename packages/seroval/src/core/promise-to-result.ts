export default async function promiseToResult(
  current: Promise<unknown>,
): Promise<[boolean, unknown]> {
  try {
    return [true, await current];
  } catch (e) {
    return [false, e];
  }
}
