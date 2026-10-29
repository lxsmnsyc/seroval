import type { SerovalNode } from 'seroval';
import { createPlugin } from 'seroval';
import { expectObject, expectOptionalBoolean, expectString } from './validate';

function createEventOptions(current: Event): EventInit {
  return {
    bubbles: current.bubbles,
    cancelable: current.cancelable,
    composed: current.composed,
  };
}

// Copies only the known fields, each checked, so the constructor never reads
// an input object.
function expectEventOptions(value: unknown): EventInit {
  const options = expectObject(value);
  return {
    bubbles: expectOptionalBoolean(options.bubbles),
    cancelable: expectOptionalBoolean(options.cancelable),
    composed: expectOptionalBoolean(options.composed),
  };
}

type EventNode = {
  type: SerovalNode;
  options: SerovalNode;
};

const EventPlugin = /* @__PURE__ */ createPlugin<Event, EventNode>({
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
  deserialize(node, ctx) {
    return new Event(
      expectString(ctx.deserialize(node.type)),
      expectEventOptions(ctx.deserialize(node.options)),
    );
  },
});

export default EventPlugin;
