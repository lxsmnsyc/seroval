import type { SerovalNode } from 'seroval';
import { createPlugin, SerovalPluginValidationError } from 'seroval';
import * as v from 'seroval/validator';

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
  validate: { type: v.string, buffer: v.arrayBuffer },
  deserialize(node, ctx) {
    return new Blob([ctx.deserialize<ArrayBuffer>(node.buffer)], {
      type: ctx.deserialize<string>(node.type),
    });
  },

  binary: {
    serialize(value) {
      return {
        type: value.type,
        bytes: value.arrayBuffer(),
      };
    },
    validate: { type: v.string, bytes: /* @__PURE__ */ v.instanceOf(Promise) },
    async deserialize(data) {
      // `bytes` is checked to be a Promise, but what it resolves to is only
      // known here.
      const bytes: unknown = await data.bytes;
      if (!(bytes instanceof ArrayBuffer)) {
        throw new SerovalPluginValidationError('seroval-plugins/web/Blob', 'bytes');
      }
      return new Blob([bytes], {
        type: data.type,
      });
    },
  },
});

export default BlobPlugin;
