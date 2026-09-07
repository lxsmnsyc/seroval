import type { SerovalNode } from 'seroval';
import { createPlugin } from 'seroval';

const PROMISE_TO_ABORT_SIGNAL = (promise: Promise<unknown>) => {
  const controller = new AbortController();
  const abort = controller.abort.bind(controller);
  promise.then(abort, abort);
  return controller;
};

function resolveAbortSignalResult(
  this: AbortSignal,
  resolve: (value: unknown) => void,
): void {
  resolve(this.reason);
}

function resolveAbortSignal(
  this: AbortSignal,
  resolve: (value: unknown) => void,
): void {
  this.addEventListener('abort', resolveAbortSignalResult.bind(this, resolve), {
    once: true,
  });
}

function abortSignalToPromise(signal: AbortSignal): Promise<unknown> {
  return new Promise(resolveAbortSignal.bind(signal));
}

const ABORT_CONTROLLER = {};

const AbortControllerFactoryPlugin = /* @__PURE__ */ createPlugin<object, {}>({
  tag: 'seroval-plugins/web/AbortControllerFactoryPlugin',
  test(value) {
    return value === ABORT_CONTROLLER;
  },
  parse: {
    sync() {
      return ABORT_CONTROLLER;
    },
    async async() {
      return await Promise.resolve(ABORT_CONTROLLER);
    },
    stream() {
      return ABORT_CONTROLLER;
    },
  },
  serialize() {
    return PROMISE_TO_ABORT_SIGNAL.toString();
  },
  deserialize() {
    // This factory is a serialize-only helper: `AbortSignalPlugin` calls
    // `PROMISE_TO_ABORT_SIGNAL` directly and never deserializes this node.
    // Returning the raw function would hand an untrusted payload a callable
    // gadget, so deserializing it directly is an invalid path.
    throw new Error(
      'seroval-plugins/web/AbortControllerFactoryPlugin cannot be deserialized directly.',
    );
  },
});

const AbortSignalPlugin = /* @__PURE__ */ createPlugin<
  AbortSignal,
  { reason?: SerovalNode; controller?: SerovalNode; factory?: SerovalNode }
>({
  tag: 'seroval-plugins/web/AbortSignal',
  extends: [AbortControllerFactoryPlugin],
  test(value) {
    if (typeof AbortSignal === 'undefined') {
      return false;
    }
    return value instanceof AbortSignal;
  },
  parse: {
    sync(value, ctx) {
      if (value.aborted) {
        return {
          reason: ctx.parse(value.reason),
        };
      }
      return {};
    },
    async async(value, ctx) {
      if (value.aborted) {
        return {
          reason: await ctx.parse(value.reason),
        };
      }
      const result = await abortSignalToPromise(value);
      return {
        reason: await ctx.parse(result),
      };
    },
    stream(value, ctx) {
      if (value.aborted) {
        return {
          reason: ctx.parse(value.reason),
        };
      }

      const promise = abortSignalToPromise(value);

      return {
        factory: ctx.parse(ABORT_CONTROLLER),
        controller: ctx.parse(promise),
      };
    },
  },
  serialize(node, ctx) {
    if (node.reason) {
      return 'AbortSignal.abort(' + ctx.serialize(node.reason) + ')';
    }
    if (node.controller && node.factory) {
      return (
        '(' +
        ctx.serialize(node.factory) +
        ')(' +
        ctx.serialize(node.controller) +
        ').signal'
      );
    }
    return '(new AbortController).signal';
  },
  deserialize(node, ctx) {
    if (node.reason) {
      return AbortSignal.abort(ctx.deserialize(node.reason));
    }
    if (node.controller) {
      const controller = ctx.deserialize(node.controller);
      // `node.controller` is any node the input picked; it must resolve to a
      // native Promise before its `then` is called, so a fake thenable (for
      // example one minted by a function-returning plugin) can never have its
      // `then` invoked here.
      if (!(controller instanceof Promise)) {
        throw new Error('Expected a Promise source.');
      }
      return PROMISE_TO_ABORT_SIGNAL(controller).signal;
    }
    const controller = new AbortController();
    return controller.signal;
  },
});

export default AbortSignalPlugin;
