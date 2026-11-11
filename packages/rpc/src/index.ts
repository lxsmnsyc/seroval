import type {
  Channel,
  ChannelOptions,
  Endpoint,
  EndpointOptions,
  Functions,
  MessagePortLike,
} from './types';

export * from './errors';
export type * from './types';

/** Makes a channel that owns `functions`. */
export function createChannel<T extends Functions>(
  _functions: T,
  _options?: ChannelOptions,
): Channel<T> {
  throw new Error('createChannel is not implemented (rpc-endpoint).');
}

/** Ties a channel table and the transport to one message port. */
export function createEndpoint(_port: MessagePortLike, _options: EndpointOptions): Endpoint {
  throw new Error('createEndpoint is not implemented (rpc-endpoint).');
}

/** Marks `value` to move with the message instead of being copied. */
export function transfer<T extends Transferable>(_value: T): T {
  throw new Error('transfer is not implemented (rpc-endpoint).');
}
