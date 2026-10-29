import type { SerovalNode } from 'seroval';
import { createPlugin } from 'seroval';
import { expectObject, expectOptionalBoolean, expectString } from './validate';

function createCustomEventOptions(current: CustomEvent): CustomEventInit {
  return {
    detail: current.detail as unknown,
    bubbles: current.bubbles,
    cancelable: current.cancelable,
    composed: current.composed,
  };
}

// Copies only the known fields, each checked, so the constructor never reads
// an input object. `detail` can be any value.
function expectCustomEventOptions(value: unknown): CustomEventInit {
  const options = expectObject(value);
  return {
    detail: options.detail,
    bubbles: expectOptionalBoolean(options.bubbles),
    cancelable: expectOptionalBoolean(options.cancelable),
    composed: expectOptionalBoolean(options.composed),
  };
}

type CustomEventNode = {
  type: SerovalNode;
  options: SerovalNode;
};

const CustomEventPlugin = /* @__PURE__ */ createPlugin<CustomEvent, CustomEventNode>({
  tag: 'seroval-plugins/web/CustomEvent',
  skipPlainObjects: true,
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
    return 'new CustomEvent(' + ctx.serialize(node.type) + ',' + ctx.serialize(node.options) + ')';
  },
  deserialize(node, ctx) {
    return new CustomEvent(
      expectString(ctx.deserialize(node.type)),
      expectCustomEventOptions(ctx.deserialize(node.options)),
    );
  },
});

export default CustomEventPlugin;
