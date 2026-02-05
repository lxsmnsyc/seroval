import type { SerovalNode } from 'seroval';
import { createPlugin } from 'seroval';

function createCustomEventOptions(current: CustomEvent): CustomEventInit {
  return {
    detail: current.detail as unknown,
    bubbles: current.bubbles,
    cancelable: current.cancelable,
    composed: current.composed,
  };
}

type CustomEventNode = {
  type: SerovalNode;
  options: SerovalNode;
};

type CustomEventBinaryData = {
  type: string;
  options: CustomEventInit;
};

const CustomEventPlugin = /* @__PURE__ */ createPlugin<
  CustomEvent,
  CustomEventNode,
  CustomEventBinaryData
>({
  tag: 'seroval-plugins/web/CustomEvent',
  test(value) {
    if (typeof CustomEvent === 'undefined') {
      return false;
    }
    return value instanceof CustomEvent;
  },
  parse: {
    sync(value, ctx) {
      return {
        type: ctx.parse(value.type),
        options: ctx.parse(createCustomEventOptions(value)),
      };
    },
    async async(value, ctx) {
      return {
        type: await ctx.parse(value.type),
        options: await ctx.parse(createCustomEventOptions(value)),
      };
    },
    stream(value, ctx) {
      return {
        type: ctx.parse(value.type),
        options: ctx.parse(createCustomEventOptions(value)),
      };
    },
  },
  serialize(node, ctx) {
    return (
      'new CustomEvent(' +
      ctx.serialize(node.type) +
      ',' +
      ctx.serialize(node.options) +
      ')'
    );
  },
  deserialize(node, ctx) {
    return new CustomEvent(
      ctx.deserialize(node.type) as string,
      ctx.deserialize(node.options) as CustomEventInit,
    );
  },
  binary: {
    serialize(value) {
      return {
        type: value.type,
        options: createCustomEventOptions(value),
      };
    },
    deserialize(data) {
      return new CustomEvent(data.type, data.options);
    },
  },
});

export default CustomEventPlugin;
