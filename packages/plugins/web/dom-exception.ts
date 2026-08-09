import type { SerovalNode } from 'seroval';
import { createPlugin } from 'seroval';

type DOMExceptionNode = {
  name: SerovalNode;
  message: SerovalNode;
};

type DOMExceptionBinaryData = {
  name: string;
  message: string;
};

const DOMExceptionPlugin = /* @__PURE__ */ createPlugin<
  DOMException,
  DOMExceptionNode,
  DOMExceptionBinaryData
>({
  tag: 'seroval-plugins/web/DOMException',
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
    return (
      'new DOMException(' +
      ctx.serialize(node.message) +
      ',' +
      ctx.serialize(node.name) +
      ')'
    );
  },
  deserialize(node, ctx) {
    return new DOMException(
      ctx.deserialize(node.message) as string,
      ctx.deserialize(node.name) as string,
    );
  },
  binary: {
    serialize(value) {
      return {
        name: value.name,
        message: value.message,
      };
    },
    deserialize(data) {
      return new DOMException(data.message, data.name);
    },
  },
});

export default DOMExceptionPlugin;
