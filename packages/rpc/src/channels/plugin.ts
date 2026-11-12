import { createPlugin } from 'seroval/read';
import type { Plugin, SerovalNode } from 'seroval/read';
import { RpcTransportError } from '../errors';
import type { Channel, Functions } from '../types';

const CHANNEL_TAG = '@seroval/rpc/Channel';

type ChannelNode = { i: SerovalNode };

/** What the plugin asks of the endpoint that owns it. */
export interface ChannelHooks {
  /** Registers a channel this side owns and returns the ID it goes out under. */
  sendChannel(value: unknown): number;
  /** Returns the receiver for an ID the other side sent. */
  receiveChannel(id: number): Channel<Functions>;
  /** True for a channel made by `createChannel`. */
  isChannel(value: unknown): boolean;
}

function isChannelId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function refuseSerialize(): never {
  throw new RpcTransportError('A channel can only be sent through an endpoint.');
}

/** Makes the plugin that writes a channel as its ID, for one endpoint. */
export function createChannelPlugin(hooks: ChannelHooks): Plugin<Channel<Functions>, ChannelNode> {
  return createPlugin<Channel<Functions>, ChannelNode>({
    tag: CHANNEL_TAG,
    test(value) {
      return hooks.isChannel(value);
    },
    parse: {
      sync(value, ctx) {
        return { i: ctx.parse(hooks.sendChannel(value)) };
      },
      async async(value, ctx) {
        return { i: await ctx.parse(hooks.sendChannel(value)) };
      },
      stream(value, ctx) {
        return { i: ctx.parse(hooks.sendChannel(value)) };
      },
    },
    serialize: refuseSerialize,
    validate: { i: isChannelId },
    deserialize(node, ctx) {
      return hooks.receiveChannel(ctx.deserialize<number>(node.i));
    },
  });
}
