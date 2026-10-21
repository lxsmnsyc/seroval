import type { SerovalNode } from 'seroval';
import { createPlugin } from 'seroval';
import { expectString } from './validate';

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
    deserialize(node, ctx) {
      return new URLSearchParams(expectString(ctx.deserialize(node.value)));
    },
  },
);

export default URLSearchParamsPlugin;
