export function createRequestOptions(
  current: Request,
  body: ArrayBuffer | ReadableStream | null,
): RequestInit {
  return {
    body,
    cache: current.cache,
    credentials: current.credentials,
    headers: current.headers,
    integrity: current.integrity,
    keepalive: current.keepalive,
    method: current.method,
    mode: current.mode,
    redirect: current.redirect,
    referrer: current.referrer,
    referrerPolicy: current.referrerPolicy,
  };
}

export function createResponseOptions(
  current: Response,
): ResponseInit {
  return {
    headers: current.headers,
    status: current.status,
    statusText: current.statusText,
  };
}

export function createEventOptions(
  current: Event,
): EventInit {
  return {
    bubbles: current.bubbles,
    cancelable: current.cancelable,
    composed: current.composed,
  };
}

export function createCustomEventOptions(
  current: CustomEvent,
): CustomEventInit {
  return {
    detail: current.detail as unknown,
    bubbles: current.bubbles,
    cancelable: current.cancelable,
    composed: current.composed,
  };
}
