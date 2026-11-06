import type { SerovalNode } from 'seroval';
import { createPlugin } from 'seroval';
import * as v from 'seroval/validator';

function createEventOptions(current: Event): EventInit {
  return {
    bubbles: current.bubbles,
    cancelable: current.cancelable,
    composed: current.composed,
  };
}

// Each known field is checked, so the constructor never converts an input
// object to a boolean.
const isEventOptions = /* @__PURE__ */ v.object({
  bubbles: /* @__PURE__ */ v.optional(v.boolean),
  cancelable: /* @__PURE__ */ v.optional(v.boolean),
  composed: /* @__PURE__ */ v.optional(v.boolean),
});

// Copies only the known fields, so the constructor never reads one the
// validator skipped.
function copyEventOptions(options: EventInit): EventInit {
  return {
    bubbles: options.bubbles,
    cancelable: options.cancelable,
    composed: options.composed,
  };
}

type EventNode = {
  type: SerovalNode;
  options: SerovalNode;
};
type EventBinaryData = {
  type: string;
  options: EventInit;
};

const EventPlugin = /* @__PURE__ */ createPlugin<Event, EventNode, EventBinaryData>({
  tag: 'seroval-plugins/web/Event',
  skipPlainObjects: true,
  test(value) {
    if (typeof Event === 'undefined') {
      return false;
    }
    return value instanceof Event;
  },
  parse: {
    sync(value, ctx) {
      return {
        type: ctx.parse(value.type),
        options: ctx.parse(createEventOptions(value)),
      };
    },
    async async(value, ctx) {
      return {
        type: await ctx.parse(value.type),
        options: await ctx.parse(createEventOptions(value)),
      };
    },
    stream(value, ctx) {
      return {
        type: ctx.parse(value.type),
        options: ctx.parse(createEventOptions(value)),
      };
    },
  },
  serialize(node, ctx) {
    return 'new Event(' + ctx.serialize(node.type) + ',' + ctx.serialize(node.options) + ')';
  },
  validate: { type: v.string, options: isEventOptions },
  deserialize(node, ctx) {
    return new Event(
      ctx.deserialize<string>(node.type),
      copyEventOptions(ctx.deserialize<EventInit>(node.options)),
    );
  },
  binary: {
    serialize(value) {
      return {
        type: value.type,
        options: createEventOptions(value),
      };
    },
    validate: { type: v.string, options: isEventOptions },
    deserialize(data) {
      return new Event(data.type, copyEventOptions(data.options));
    },
  },
});

export default EventPlugin;
