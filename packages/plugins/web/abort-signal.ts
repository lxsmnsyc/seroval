import type { SerovalNode } from 'seroval';
import { createPlugin } from 'seroval';

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

export function abortSignalToPromise(signal: AbortSignal): Promise<unknown> {
  return new Promise(resolveAbortSignal.bind(signal));
}

class AbortSignalController {
  controller = new AbortController();
}

const AbortSignalControllerPlugin = createPlugin<AbortSignalController, {}>({
  tag: 'seroval-plugins/web/AbortSignalController',
  test(value) {
    // We didn't actually use the AbortController class
    // directly because of some assumptions
    return value instanceof AbortSignalController;
  },
  parse: {
    stream() {
      return {};
    },
  },
  serialize(_node) {
    return 'new AbortController';
  },
  deserialize(_node) {
    return new AbortSignalController();
  },
});

type AbortSignalAbortNode = {
  controller: SerovalNode;
  reason: SerovalNode;
};

class AbortSignalAbort {
  constructor(
    public controller: AbortSignalController,
    public reason: unknown,
  ) {}
}

const AbortSignalAbortPlugin = createPlugin<
  AbortSignalAbort,
  AbortSignalAbortNode
>({
  extends: [AbortSignalControllerPlugin],
  tag: 'seroval-plugins/web/AbortSignalAbort',
  test(value) {
    return value instanceof AbortSignalAbort;
  },
  parse: {
    stream(value, ctx) {
      return {
        controller: ctx.parse(value.controller),
        reason: ctx.parse(value.reason),
      };
    },
  },
  serialize(node, ctx) {
    return (
      ctx.serialize(node.controller) +
      '.abort(' +
      ctx.serialize(node.reason) +
      ')'
    );
  },
  deserialize(node, ctx) {
    const controller = ctx.deserialize(
      node.controller,
    ) as AbortSignalController;
    const reason = ctx.deserialize(node.reason);
    controller.controller.abort(reason);
    return new AbortSignalAbort(controller, reason);
  },
});

const AbortSignalPlugin = createPlugin<
  AbortSignal,
  { reason?: SerovalNode; controller?: SerovalNode }
>({
  tag: 'seroval-plugins/web/AbortSignal',
  extends: [AbortSignalAbortPlugin],
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
      const controller = new AbortSignalController();

      ctx.pushPendingState();
      value.addEventListener(
        'abort',
        () => {
          const result = ctx.parseWithError(
            new AbortSignalAbort(controller, value.reason),
          );
          if (result) {
            ctx.onParse(result);
          }
          ctx.popPendingState();
        },
        { once: true },
      );

      return {
        controller: ctx.parse(controller),
      };
    },
  },
  serialize(node, ctx) {
    if (node.reason) {
      return 'AbortSignal.abort(' + ctx.serialize(node.reason) + ')';
    }
    if (node.controller) {
      return '(' + ctx.serialize(node.controller) + ').signal';
    }
    return '(new AbortController).signal';
  },
  deserialize(node, ctx) {
    if (node.reason) {
      return AbortSignal.abort(ctx.deserialize(node.reason));
    }
    if (node.controller) {
      const controller = ctx.deserialize(
        node.controller,
      ) as AbortSignalController;
      return controller.controller.signal;
    }
    const controller = new AbortController();
    return controller.signal;
  },
});

export default AbortSignalPlugin;
