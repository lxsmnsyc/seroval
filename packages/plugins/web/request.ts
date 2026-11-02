import type { SerovalNode } from 'seroval';
import { createPlugin } from 'seroval';
import HeadersPlugin from './headers';
import ReadableStreamPlugin from './readable-stream';
import {
  expectBody,
  expectHeaders,
  expectObject,
  expectOptionalBoolean,
  expectOptionalString,
  expectString,
} from './validate';

function createRequestOptions(
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

function createStreamRequestOptions(
  current: Request,
  body: ReadableStream | null,
): RequestInit & { duplex?: 'half' } {
  const options: RequestInit & { duplex?: 'half' } = createRequestOptions(current, body);
  if (body) {
    // A stream body needs `duplex: 'half'` where stream bodies are supported
    // (Chrome 105+, Node 19.1+). Runtimes without the option ignore the key.
    options.duplex = 'half';
  }
  return options;
}

// Firefox has no `Request.body` getter, so `undefined` does not mean the
// request has no body. GET and HEAD requests cannot carry one.
function hasRequestBody(current: Request): boolean {
  if (current.bodyUsed) {
    return false;
  }
  if (current.body !== undefined) {
    return current.body !== null;
  }
  return current.method !== 'GET' && current.method !== 'HEAD';
}

function createRequestBodyStream(current: Request): ReadableStream {
  const clone = current.clone();
  if (clone.body) {
    return clone.body;
  }
  // Without `Request.body`, read the whole body and push it into a new stream.
  return new ReadableStream({
    start(controller) {
      clone.arrayBuffer().then(
        (buffer) => {
          if (buffer.byteLength > 0) {
            controller.enqueue(new Uint8Array(buffer));
          }
          controller.close();
        },
        (error: unknown) => {
          controller.error(error);
        },
      );
    },
  });
}

// Copies only the known fields, each checked, so the constructor never
// converts an input object to a string.
function expectRequestOptions(value: unknown): RequestInit & { duplex?: 'half' } {
  const options = expectObject(value);
  return {
    body: expectBody(options.body),
    cache: expectOptionalString(options.cache) as RequestCache | undefined,
    credentials: expectOptionalString(options.credentials) as RequestCredentials | undefined,
    headers: expectHeaders(options.headers),
    integrity: expectOptionalString(options.integrity),
    keepalive: expectOptionalBoolean(options.keepalive),
    method: expectOptionalString(options.method),
    mode: expectOptionalString(options.mode) as RequestMode | undefined,
    redirect: expectOptionalString(options.redirect) as RequestRedirect | undefined,
    referrer: expectOptionalString(options.referrer),
    referrerPolicy: expectOptionalString(options.referrerPolicy) as ReferrerPolicy | undefined,
    duplex: expectOptionalString(options.duplex) as 'half' | undefined,
  };
}

type RequestNode = {
  url: SerovalNode;
  options: SerovalNode;
};

const RequestPlugin = /* @__PURE__ */ createPlugin<Request, RequestNode>({
  tag: 'seroval-plugins/web/Request',
  extends: [ReadableStreamPlugin, HeadersPlugin],
  skipPlainObjects: true,
  test(value) {
    if (typeof Request === 'undefined') {
      return false;
    }
    return value instanceof Request;
  },
  parse: {
    async async(value, ctx) {
      return {
        url: await ctx.parse(value.url),
        options: await ctx.parse(
          createRequestOptions(
            value,
            hasRequestBody(value) ? await value.clone().arrayBuffer() : null,
          ),
        ),
      };
    },
    stream(value, ctx) {
      return {
        url: ctx.parse(value.url),
        options: ctx.parse(
          createStreamRequestOptions(
            value,
            hasRequestBody(value) ? createRequestBodyStream(value) : null,
          ),
        ),
      };
    },
  },
  serialize(node, ctx) {
    return 'new Request(' + ctx.serialize(node.url) + ',' + ctx.serialize(node.options) + ')';
  },
  deserialize(node, ctx) {
    return new Request(
      expectString(ctx.deserialize(node.url)),
      expectRequestOptions(ctx.deserialize(node.options)),
    );
  },
});

export default RequestPlugin;
