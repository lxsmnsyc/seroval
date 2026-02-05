import type { SerovalNode } from 'seroval';
import { createPlugin } from 'seroval';

function convertHeaders(instance: Headers): HeadersInit {
  const items: HeadersInit = [];
  // biome-ignore lint/complexity/noForEach: Headers aren't consistently iterable
  instance.forEach((value, key) => {
    items.push([key, value]);
  });
  return items;
}

const HeadersPlugin = /* @__PURE__ */ createPlugin<
  Headers,
  { value: SerovalNode },
  { value: HeadersInit }
>({
  tag: 'seroval-plugins/web/Headers',
  test(value) {
    if (typeof Headers === 'undefined') {
      return false;
    }
    return value instanceof Headers;
  },
  parse: {
    sync(value, ctx) {
      return {
        value: ctx.parse(convertHeaders(value)),
      };
    },
    async async(value, ctx) {
      return {
        value: await ctx.parse(convertHeaders(value)),
      };
    },
    stream(value, ctx) {
      return {
        value: ctx.parse(convertHeaders(value)),
      };
    },
  },
  serialize(node, ctx) {
    return 'new Headers(' + ctx.serialize(node.value) + ')';
  },
  deserialize(node, ctx) {
    return new Headers(ctx.deserialize(node.value) as HeadersInit);
  },
  binary: {
    serialize(value) {
      return { value: convertHeaders(value) };
    },
    deserialize(data) {
      return new Headers(data.value);
    },
  },
});

export default HeadersPlugin;
