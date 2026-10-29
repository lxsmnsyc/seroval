import type { SerovalNode } from 'seroval';
import { createPlugin } from 'seroval';
import * as v from 'seroval/validator';
import HeadersPlugin from './headers';
import ReadableStreamPlugin from './readable-stream';
import { isBody, isOptionalHeaders } from './validate';

function createResponseOptions(current: Response): ResponseInit {
  return {
    headers: current.headers,
    status: current.status,
    statusText: current.statusText,
  };
}

// Each known field is checked, so the constructor never converts an input
// object to a string or a number.
const isResponseOptions = /* @__PURE__ */ v.object({
  headers: isOptionalHeaders,
  status: /* @__PURE__ */ v.optional(v.number),
  statusText: /* @__PURE__ */ v.optional(v.string),
});

// Copies only the known fields, so the constructor never reads one the
// validator skipped.
function copyResponseOptions(options: ResponseInit): ResponseInit {
  return {
    headers: options.headers,
    status: options.status,
    statusText: options.statusText,
  };
}

type ResponseNode = {
  body: SerovalNode;
  options: SerovalNode;
};

type ResponseBinarydata = {
  body: ReadableStream<Uint8Array> | null;
  options: ResponseInit;
};

const ResponsePlugin = /* @__PURE__ */ createPlugin<Response, ResponseNode, ResponseBinarydata>({
  tag: 'seroval-plugins/web/Response',
  extends: [ReadableStreamPlugin, HeadersPlugin],
  skipPlainObjects: true,
  test(value) {
    if (typeof Response === 'undefined') {
      return false;
    }
    return value instanceof Response;
  },
  parse: {
    async async(value, ctx) {
      return {
        body: await ctx.parse(
          value.body && !value.bodyUsed ? await value.clone().arrayBuffer() : null,
        ),
        options: await ctx.parse(createResponseOptions(value)),
      };
    },
    stream(value, ctx) {
      return {
        body: ctx.parse(value.body && !value.bodyUsed ? value.clone().body : null),
        options: ctx.parse(createResponseOptions(value)),
      };
    },
  },
  serialize(node, ctx) {
    return 'new Response(' + ctx.serialize(node.body) + ',' + ctx.serialize(node.options) + ')';
  },
  validate: { body: isBody, options: isResponseOptions },
  deserialize(node, ctx) {
    return new Response(
      ctx.deserialize<BodyInit | null>(node.body),
      copyResponseOptions(ctx.deserialize<ResponseInit>(node.options)),
    );
  },
  binary: {
    serialize(value) {
      return {
        body: value.body && !value.bodyUsed ? value.clone().body : null,
        options: createResponseOptions(value),
      };
    },
    deserialize(data) {
      return new Response(data.body, data.options);
    },
  },
});

export default ResponsePlugin;
