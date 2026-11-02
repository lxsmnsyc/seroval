import type { SerovalNode } from 'seroval';
import { createPlugin } from 'seroval';
import * as v from 'seroval/validator';
import HeadersPlugin from './headers';
import ReadableStreamPlugin from './readable-stream';
import { isBody, isOptionalHeaders } from './validate';

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

type RequestOptions = RequestInit & { duplex?: 'half' };

// Each known field is checked, so the constructor never converts an input
// object to a string.
const isRequestOptions = /* @__PURE__ */ v.object({
  body: isBody,
  cache: /* @__PURE__ */ v.optional(v.string),
  credentials: /* @__PURE__ */ v.optional(v.string),
  headers: isOptionalHeaders,
  integrity: /* @__PURE__ */ v.optional(v.string),
  keepalive: /* @__PURE__ */ v.optional(v.boolean),
  method: /* @__PURE__ */ v.optional(v.string),
  mode: /* @__PURE__ */ v.optional(v.string),
  redirect: /* @__PURE__ */ v.optional(v.string),
  referrer: /* @__PURE__ */ v.optional(v.string),
  referrerPolicy: /* @__PURE__ */ v.optional(v.string),
  duplex: /* @__PURE__ */ v.optional(v.string),
});

// Copies only the known fields, so the constructor never reads one the
// validator skipped.
function copyRequestOptions(options: RequestOptions): RequestOptions {
  return {
    body: options.body,
    cache: options.cache,
    credentials: options.credentials,
    headers: options.headers,
    integrity: options.integrity,
    keepalive: options.keepalive,
    method: options.method,
    mode: options.mode,
    redirect: options.redirect,
    referrer: options.referrer,
    referrerPolicy: options.referrerPolicy,
    duplex: options.duplex,
  };
}

type RequestNode = {
  url: SerovalNode;
  options: SerovalNode;
};

type RequestBinaryData = {
  url: string;
  options: RequestOptions;
};

const RequestPlugin = /* @__PURE__ */ createPlugin<Request, RequestNode, RequestBinaryData>({
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
            value.body && !value.bodyUsed ? await value.clone().arrayBuffer() : null,
          ),
        ),
      };
    },
    stream(value, ctx) {
      return {
        url: ctx.parse(value.url),
        options: ctx.parse(
          createRequestOptions(value, value.body && !value.bodyUsed ? value.clone().body : null),
        ),
      };
    },
  },
  serialize(node, ctx) {
    return 'new Request(' + ctx.serialize(node.url) + ',' + ctx.serialize(node.options) + ')';
  },
  validate: { url: v.string, options: isRequestOptions },
  deserialize(node, ctx) {
    return new Request(
      ctx.deserialize<string>(node.url),
      copyRequestOptions(ctx.deserialize<RequestOptions>(node.options)),
    );
  },
  binary: {
    serialize(value) {
      const body = value.body && !value.bodyUsed ? value.clone().body : null;
      const options = createRequestOptions(value, body);
      if (body) {
        // A streamed request body is only accepted in half duplex mode.
        // Without this the receiving `new Request()` throws.
        (options as { duplex?: string }).duplex = 'half';
      }
      return {
        url: value.url,
        options,
      };
    },
    validate: { url: v.string, options: isRequestOptions },
    deserialize(data) {
      return new Request(data.url, copyRequestOptions(data.options));
    },
  },
});

export default RequestPlugin;
