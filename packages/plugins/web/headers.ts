import type { SerovalNode } from 'seroval';
import { createPlugin } from 'seroval';
import * as v from 'seroval/validator';
import { copyEntries, entries } from './validate';

const isHeadersInit = /* @__PURE__ */ entries(v.string);

type HeadersEntries = [key: string, value: string][];

function convertHeaders(instance: Headers): HeadersEntries {
  const items: HeadersEntries = [];
  instance.forEach((value, key) => {
    items.push([key, value]);
  });
  return items;
}

const HeadersPlugin = /* @__PURE__ */ createPlugin<Headers, { value: SerovalNode }>({
  tag: 'seroval-plugins/web/Headers',
  skipPlainObjects: true,
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
  validate: { value: isHeadersInit },
  deserialize(node, ctx) {
    return new Headers(copyEntries(ctx.deserialize<HeadersEntries>(node.value)));
  },
});

export default HeadersPlugin;
