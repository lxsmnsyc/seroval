import type { SerovalNode } from 'seroval';
import { createPlugin } from 'seroval';

const URLPlugin = /* @__PURE__ */ createPlugin<URL, SerovalNode>({
  tag: 'seroval-plugins/web/URL',
  test(value) {
    if (typeof URL === 'undefined') {
      return false;
    }
    return value instanceof URL;
  },
  parse: {
    sync(value, ctx) {
      return ctx.parse(value.href);
    },
    async async(value, ctx) {
      return await ctx.parse(value.href);
    },
    stream(value, ctx) {
      return ctx.parse(value.href);
    },
  },
  serialize(node, ctx) {
    return 'new URL(' + ctx.serialize(node) + ')';
  },
  deserialize(node, ctx) {
    return new URL(ctx.deserialize(node) as string);
  },
});

export default URLPlugin;
