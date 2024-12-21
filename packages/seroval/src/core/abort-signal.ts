export function abortSignalToPromise(signal: AbortSignal): Promise<any> {
  return new Promise(resolve => {
    signal.addEventListener(
      'abort',
      () => {
        resolve(signal.reason);
      },
      {
        once: true,
      },
    );
  });
}
