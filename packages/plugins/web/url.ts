import type { SerovalNode } from 'seroval';
import { createPlugin } from 'seroval';
import * as v from 'seroval/validator';

const URLPlugin = /* @__PURE__ */ createPlugin<URL, { value: SerovalNode }, { value: string }>({
  tag: 'seroval-plugins/web/URL',
  skipPlainObjects: true,
  test(value) {
    if (typeof URL === 'undefined') {
      return false;
    }
    return value instanceof URL;
  },
  parse: {
    sync(value, ctx) {
      return {
        value: ctx.parse(value.href),
      };
    },
    async async(value, ctx) {
      return {
        value: await ctx.parse(value.href),
      };
    },
    stream(value, ctx) {
      return {
        value: ctx.parse(value.href),
      };
    },
  },
  serialize(node, ctx) {
    return 'new URL(' + ctx.serialize(node.value) + ')';
  },
  validate: { value: v.string },
  deserialize(node, ctx) {
    return new URL(ctx.deserialize<string>(node.value));
  },
  binary: {
    serialize(value) {
      return { value: value.href };
    },
    validate: { value: v.string },
    deserialize(data) {
      return new URL(data.value);
    },
  },
});

export default URLPlugin;
