import type { SerovalNode } from 'seroval';
import { SerovalPluginValidationError, createPlugin } from 'seroval';
import * as v from 'seroval/validator';
import { claim } from './validate';

type BlobNode = {
  type: SerovalNode;
  buffer: SerovalNode;
};

type BlobBinaryData = {
  type: string;
  bytes: Promise<ArrayBuffer>;
};

const BlobPlugin = /* @__PURE__ */ createPlugin<Blob, BlobNode, BlobBinaryData>({
  tag: 'seroval-plugins/web/Blob',
  skipPlainObjects: true,
  test(value) {
    if (typeof Blob === 'undefined') {
      return false;
    }
    return value instanceof Blob;
  },
  parse: {
    async async(value, ctx) {
      return {
        type: await ctx.parse(value.type),
        buffer: await ctx.parse(await value.arrayBuffer()),
      };
    },
  },
  serialize(node, ctx) {
    return 'new Blob([' + ctx.serialize(node.buffer) + '],{type:' + ctx.serialize(node.type) + '})';
  },
  validate: { type: v.string, buffer: /* @__PURE__ */ v.instanceOf(ArrayBuffer) },
  deserialize(node, ctx) {
    return new Blob([claim(ctx.deserialize<ArrayBuffer>(node.buffer))], {
      type: ctx.deserialize<string>(node.type),
    });
  },

  binary: {
    serialize(value) {
      // The serializer handles this promise only once it reaches the field.
      // If serialization stops before that, at the depth limit say, a failed
      // read would be an unhandled rejection, which stops the process.
      const bytes = value.arrayBuffer();
      bytes.catch(() => undefined);
      return {
        type: value.type,
        bytes,
      };
    },
    validate: { type: v.string, bytes: /* @__PURE__ */ v.instanceOf(Promise) },
    async deserialize(data) {
      // The serializer sends a fresh payload, promise and buffer for every
      // Blob. Input that shares one between Blob values would make each of
      // them copy the same bytes, so each is claimed once.
      // `bytes` is checked to be a Promise, but what it resolves to is only
      // known here.
      const bytes: unknown = await claim(claim(data).bytes);
      if (!(bytes instanceof ArrayBuffer)) {
        throw new SerovalPluginValidationError('seroval-plugins/web/Blob', 'bytes');
      }
      return new Blob([claim(bytes)], {
        type: data.type,
      });
    },
  },
});

export default BlobPlugin;
