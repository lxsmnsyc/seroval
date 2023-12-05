import type { SerovalNode } from 'seroval';
import { createPlugin } from 'seroval';

const URLSearchParamsPlugin = createPlugin<URLSearchParams, SerovalNode>({
  tag: 'seroval-plugins/web/url-search-params',
  test(value) {
    if (typeof URLSearchParams === 'undefined') {
      return false;
    }
    return value instanceof URLSearchParams;
  },
  parse: {
    sync(value, ctx) {
      return ctx.parse(value.toString());
    },
    async async(value, ctx) {
      return ctx.parse(value.toString());
    },
    stream(value, ctx) {
      return ctx.parse(value.toString());
    },
  },
  serialize(node, ctx) {
    return 'new URLSearchParams(' + ctx.serialize(node) + ')';
  },
  deserialize(node, ctx) {
    return new URLSearchParams(ctx.deserialize(node) as string);
  },
});

export default URLSearchParamsPlugin;
