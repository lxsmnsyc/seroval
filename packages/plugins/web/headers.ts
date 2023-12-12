import type { SerovalNode } from 'seroval';
import { createPlugin } from 'seroval';

function convertHeaders(instance: Headers): HeadersInit {
  const items: HeadersInit = [];
  // biome-ignore lint/complexity/noForEach: <explanation>
  instance.forEach((value, key) => {
    items.push([key, value]);
  });
  return items;
}

const HeadersPlugin = /* @__PURE__ */ createPlugin<Headers, SerovalNode>({
  tag: 'seroval-plugins/web/Headers',
  test(value) {
    if (typeof Headers === 'undefined') {
      return false;
    }
    return value instanceof Headers;
  },
  parse: {
    sync(value, ctx) {
      return ctx.parse(convertHeaders(value));
    },
    async async(value, ctx) {
      return await ctx.parse(convertHeaders(value));
    },
    stream(value, ctx) {
      return ctx.parse(convertHeaders(value));
    },
  },
  serialize(node, ctx) {
    return 'new Headers(' + ctx.serialize(node) + ')';
  },
  deserialize(node, ctx) {
    return new Headers(ctx.deserialize(node) as HeadersInit);
  },
});

export default HeadersPlugin;
