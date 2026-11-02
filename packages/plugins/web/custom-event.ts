import type { SerovalNode } from 'seroval';
import { createPlugin } from 'seroval';
import * as v from 'seroval/validator';

function createCustomEventOptions(current: CustomEvent): CustomEventInit {
  return {
    detail: current.detail as unknown,
    bubbles: current.bubbles,
    cancelable: current.cancelable,
    composed: current.composed,
  };
}

// Each known field is checked, so the constructor never converts an input
// object to a boolean. `detail` can be any value.
const isCustomEventOptions = /* @__PURE__ */ v.object({
  bubbles: /* @__PURE__ */ v.optional(v.boolean),
  cancelable: /* @__PURE__ */ v.optional(v.boolean),
  composed: /* @__PURE__ */ v.optional(v.boolean),
});

// Copies only the known fields, so the constructor never reads one the
// validator skipped.
function copyCustomEventOptions(options: CustomEventInit): CustomEventInit {
  return {
    detail: options.detail,
    bubbles: options.bubbles,
    cancelable: options.cancelable,
    composed: options.composed,
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
  validate: { type: v.string, options: isCustomEventOptions },
  deserialize(node, ctx) {
    return new CustomEvent(
      ctx.deserialize<string>(node.type),
      copyCustomEventOptions(ctx.deserialize<CustomEventInit>(node.options)),
    );
  },
  binary: {
    serialize(value) {
      return {
        type: value.type,
        options: createCustomEventOptions(value),
      };
    },
    validate: { type: v.string, options: isCustomEventOptions },
    deserialize(data) {
      return new CustomEvent(data.type, copyCustomEventOptions(data.options));
    },
  },
});

export default CustomEventPlugin;
