import type { SerovalNode } from 'seroval';
import { createPlugin, SerovalPluginValidationError, v } from 'seroval';

const TAG = 'seroval-plugins/web/Blob';

type BlobNode = {
  type: SerovalNode;
  buffer: SerovalNode;
};

const BlobPlugin = /* @__PURE__ */ createPlugin<Blob, BlobNode>({
  tag: TAG,
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
    return (
      'new Blob([' +
      ctx.serialize(node.buffer) +
      '],{type:' +
      ctx.serialize(node.type) +
      '})'
    );
  },
  deserialize(node, ctx) {
    const buffer = ctx.deserialize(node.buffer);
    const type = ctx.deserialize(node.type);
    // The payload is untrusted; reject anything that is not what we serialized.
    if (!v.arrayBuffer(buffer)) {
      throw new SerovalPluginValidationError(TAG);
    }
    if (!v.string(type)) {
      throw new SerovalPluginValidationError(TAG);
    }
    return new Blob([buffer], { type });
  },
});

export default BlobPlugin;
