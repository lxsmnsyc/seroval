import type { SerovalNode } from 'seroval';
import { createPlugin } from 'seroval';
import * as v from 'seroval/validator';

type BlobNode = {
  type: SerovalNode;
  buffer: SerovalNode;
};

const BlobPlugin = /* @__PURE__ */ createPlugin<Blob, BlobNode>({
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
    return new Blob([ctx.deserialize<ArrayBuffer>(node.buffer)], {
      type: ctx.deserialize<string>(node.type),
    });
  },
});

export default BlobPlugin;
