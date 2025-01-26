function resolveAbortSignalResult(
  this: AbortSignal,
  resolve: (value: any) => void,
): void {
  resolve(this.reason);
}

function resolveAbortSignal(
  this: AbortSignal,
  resolve: (value: any) => void,
): void {
  this.addEventListener('abort', resolveAbortSignalResult.bind(this, resolve), {
    once: true,
  });
}

export function abortSignalToPromise(signal: AbortSignal): Promise<any> {
  return new Promise(resolveAbortSignal.bind(signal));
}
