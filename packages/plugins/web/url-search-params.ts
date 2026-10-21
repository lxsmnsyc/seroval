import type { SerovalNode } from 'seroval';
import { createPlugin } from 'seroval';
import * as v from 'seroval/validator';

const URLSearchParamsPlugin = /* @__PURE__ */ createPlugin<URLSearchParams, { value: SerovalNode }>(
  {
    tag: 'seroval-plugins/web/URLSearchParams',
    skipPlainObjects: true,
    test(value) {
      if (typeof URLSearchParams === 'undefined') {
        return false;
      }
      return value instanceof URLSearchParams;
    },
    parse: {
      sync(value, ctx) {
        return {
          value: ctx.parse(value.toString()),
        };
      },
      async async(value, ctx) {
        return {
          value: await ctx.parse(value.toString()),
        };
      },
      stream(value, ctx) {
        return {
          value: ctx.parse(value.toString()),
        };
      },
    },
    serialize(node, ctx) {
      return 'new URLSearchParams(' + ctx.serialize(node.value) + ')';
    },
    validate: { value: v.string },
    deserialize(node, ctx) {
      return new URLSearchParams(ctx.deserialize<string>(node.value));
    },
  },
);

export default URLSearchParamsPlugin;
