import type { SerovalNode } from 'seroval';
import { createPlugin } from 'seroval';
import * as v from 'seroval/validator';

type DOMExceptionNode = {
  name: SerovalNode;
  message: SerovalNode;
};

const DOMExceptionPlugin = /* @__PURE__ */ createPlugin<DOMException, DOMExceptionNode>({
  tag: 'seroval-plugins/web/DOMException',
  skipPlainObjects: true,
  test(value) {
    if (typeof DOMException === 'undefined') {
      return false;
    }
    return value instanceof DOMException;
  },
  parse: {
    sync(value, ctx) {
      return {
        name: ctx.parse(value.name),
        message: ctx.parse(value.message),
      };
    },
    async async(value, ctx) {
      return {
        name: await ctx.parse(value.name),
        message: await ctx.parse(value.message),
      };
    },
    stream(value, ctx) {
      return {
        name: ctx.parse(value.name),
        message: ctx.parse(value.message),
      };
    },
  },
  serialize(node, ctx) {
    return 'new DOMException(' + ctx.serialize(node.message) + ',' + ctx.serialize(node.name) + ')';
  },
  validate: { name: v.string, message: v.string },
  deserialize(node, ctx) {
    return new DOMException(
      ctx.deserialize<string>(node.message),
      ctx.deserialize<string>(node.name),
    );
  },
});

export default DOMExceptionPlugin;
