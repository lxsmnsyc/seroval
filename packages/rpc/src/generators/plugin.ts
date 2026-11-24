/* oxlint-disable typescript/promise-function-async, typescript/no-unsafe-type-assertion, typescript/no-unnecessary-type-assertion -- steps must start in order, so they return promises without async; the channel types are erased at the boundary. */
import { createPlugin } from 'seroval/read';
import type { Plugin, SerovalNode } from 'seroval/read';
import { createChannel } from '../channel';
import { RpcTransportError } from '../errors';
import type { Channel, Functions } from '../types';

const GENERATOR_TAG = '@seroval/rpc/Generator';

type GeneratorNode = { i: SerovalNode };
type AnyGenerator =
  | Generator<unknown, unknown, unknown>
  | AsyncGenerator<unknown, unknown, unknown>;
type Step = IteratorResult<unknown, unknown>;

/** What the plugin asks of the endpoint that owns it. */
export interface GeneratorHooks {
  /** Registers a channel this side owns and returns the ID it goes out under. */
  sendChannel(value: unknown): number;
  /** Returns the receiver for an ID the other side sent. */
  receiveChannel(id: number): Channel<Functions>;
}

// The wrappers this module made for generators the other side sent.
const REMOTE_GENERATORS = new WeakSet<object>();

/** Tells a generator the other side runs from a one-way stream. */
export function isRemoteGenerator(value: object): boolean {
  return REMOTE_GENERATORS.has(value);
}

function isNativeGenerator(value: unknown): value is AnyGenerator {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const tag = Object.prototype.toString.call(value);
  return tag === '[object Generator]' || tag === '[object AsyncGenerator]';
}

function isChannelId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function refuseSerialize(): never {
  throw new RpcTransportError('A generator can only be sent through an endpoint.');
}

function ignoreRejection(): void {}

/** Makes the hidden channel that runs a generator for the other side. */
function createGeneratorChannel(generator: AnyGenerator): Channel<Functions> {
  return createChannel(
    {
      next(value?: unknown) {
        return generator.next(value);
      },
      throw(error?: unknown) {
        return generator.throw(error);
      },
      return(value?: unknown) {
        return generator.return(value);
      },
    },
    {
      onClose() {
        // A channel that closes early still runs the generator's finally.
        // Do not wait: a generator stuck in a step must not hold back the close.
        try {
          Promise.resolve(generator.return(undefined)).catch(ignoreRejection);
        } catch {
          // A sync generator that is running a step throws here. It ends on its own.
        }
      },
    },
  );
}

/** Wraps the channel of a remote generator as an `AsyncGenerator`. */
function wrapChannel(channel: Channel<Functions>): AsyncGenerator<unknown, unknown, unknown> {
  let finished = false;

  function finish(): void {
    if (!finished) {
      finished = true;
      // The generator is over, so the hidden channel goes too.
      channel.close();
    }
  }

  async function step(name: 'next' | 'throw' | 'return', argument: unknown): Promise<Step> {
    if (finished) {
      // A finished generator answers locally, like a native one.
      if (name === 'throw') {
        throw argument;
      }
      return { done: true, value: name === 'return' ? argument : undefined };
    }
    let result: Step;
    try {
      result = (await channel.run(name, argument as never)) as Step;
    } catch (error) {
      // A generator that threw is finished, and so is one whose channel closed.
      finish();
      throw error;
    }
    if (result.done) {
      finish();
    }
    return result;
  }

  async function dispose(): Promise<void> {
    await step('return', undefined).catch(ignoreRejection);
  }

  const wrapper: AsyncGenerator<unknown, unknown, unknown> = {
    next: (value?: unknown) => step('next', value),
    throw: (error?: unknown) => step('throw', error),
    return: (value?: unknown) => step('return', value),
    [Symbol.asyncIterator](): AsyncGenerator<unknown, unknown, unknown> {
      return wrapper;
    },
    // The tag lets the plugin send a received generator on to another endpoint.
    [Symbol.toStringTag]: 'AsyncGenerator',
  } as unknown as AsyncGenerator<unknown, unknown, unknown>;
  // Some runtimes have no `Symbol.asyncDispose` yet.
  if (typeof Symbol.asyncDispose === 'symbol') {
    Object.defineProperty(wrapper, Symbol.asyncDispose, { value: dispose });
  }
  REMOTE_GENERATORS.add(wrapper);
  return wrapper;
}

/** Makes the plugin that sends a native generator as a hidden channel. */
export function createGeneratorPlugin(hooks: GeneratorHooks): Plugin<AnyGenerator, GeneratorNode> {
  function sendGenerator(value: AnyGenerator): number {
    return hooks.sendChannel(createGeneratorChannel(value));
  }
  return createPlugin<AnyGenerator, GeneratorNode>({
    tag: GENERATOR_TAG,
    test: isNativeGenerator,
    parse: {
      sync(value, ctx) {
        return { i: ctx.parse(sendGenerator(value)) };
      },
      async async(value, ctx) {
        return { i: await ctx.parse(sendGenerator(value)) };
      },
      stream(value, ctx) {
        return { i: ctx.parse(sendGenerator(value)) };
      },
    },
    serialize: refuseSerialize,
    validate: { i: isChannelId },
    deserialize(node, ctx) {
      return wrapChannel(hooks.receiveChannel(ctx.deserialize<number>(node.i))) as AnyGenerator;
    },
  });
}
