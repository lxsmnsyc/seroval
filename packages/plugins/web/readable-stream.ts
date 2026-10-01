import type { SerovalNode, Stream } from 'seroval';
import { createPlugin, createStream } from 'seroval';

const READABLE_STREAM_FACTORY = {};

// Serialized via toString() — only use method shorthand for nested functions.
// Their name comes from the property key at runtime, so name-preserving
// transforms (esbuild keepNames) have nothing to wrap; any other shape gets
// rewritten to call a bundle-scoped helper that does not exist in the
// receiving realm. https://github.com/lxsmnsyc/seroval/issues/87
const READABLE_STREAM_FACTORY_CONSTRUCTOR = (stream: Stream<unknown>) =>
  new ReadableStream({
    start(controller) {
      stream.on({
        next(value) {
          try {
            controller.enqueue(value);
          } catch (_error) {
            // no-op
          }
        },
        throw(value) {
          controller.error(value);
        },
        return() {
          try {
            controller.close();
          } catch (_error) {
            // no-op
          }
        },
      });
    },
  });

const ReadableStreamFactoryPlugin = /* @__PURE__ */ createPlugin<
  object,
  {},
  {}
>({
  tag: 'seroval-plugins/web/ReadableStreamFactory',
  test(value) {
    return value === READABLE_STREAM_FACTORY;
  },
  parse: {
    sync() {
      return READABLE_STREAM_FACTORY;
    },
    async async() {
      return await Promise.resolve(READABLE_STREAM_FACTORY);
    },
    stream() {
      return READABLE_STREAM_FACTORY;
    },
  },
  serialize() {
    return READABLE_STREAM_FACTORY_CONSTRUCTOR.toString();
  },
  deserialize() {
    return READABLE_STREAM_FACTORY;
  },
  binary: {
    serialize() {
      return READABLE_STREAM_FACTORY;
    },
    deserialize() {
      return READABLE_STREAM_FACTORY;
    },
  },
});

function toAsyncIterable<T>(
  value: ReadableStream<T>,
): AsyncIterable<T | undefined> {
  return {
    [Symbol.asyncIterator]() {
      const reader = value.getReader();
      let active = true;
      let reading = false;
      const release = (): void => {
        try {
          reader.releaseLock();
        } catch (_error) {
          // no-op
        }
      };
      return {
        async next() {
          if (!active) {
            return { done: true, value: undefined };
          }
          reading = true;
          let result: ReadableStreamReadResult<T>;
          try {
            result = await reader.read();
          } catch (error) {
            reading = false;
            release();
            if (!active) {
              return { done: true, value: undefined };
            }
            active = false;
            throw error;
          }
          reading = false;
          if (!active || result.done) {
            active = false;
            release();
            return { done: true, value: undefined };
          }
          return result;
        },
        return(reason?: unknown) {
          if (active) {
            active = false;
            try {
              reader.cancel(reason).catch(() => {
                // no-op
              });
            } catch (_error) {
              // no-op
            }
            if (!reading) {
              release();
            }
          }
          return Promise.resolve({ done: true, value: undefined });
        },
      };
    },
  };
}

type ReadableStreamNode = {
  factory: SerovalNode;
  stream: SerovalNode;
};

type ReadableStreamBinaryData = {
  stream: Stream<unknown>;
};

const ReadableStreamPlugin = /* @__PURE__ */ createPlugin<
  ReadableStream,
  ReadableStreamNode,
  ReadableStreamBinaryData
>({
  tag: 'seroval/plugins/web/ReadableStream',
  extends: [ReadableStreamFactoryPlugin],
  test(value) {
    if (typeof ReadableStream === 'undefined') {
      return false;
    }
    return value instanceof ReadableStream;
  },
  parse: {
    sync(_value, ctx) {
      return {
        factory: ctx.parse(READABLE_STREAM_FACTORY),
        stream: ctx.parse(createStream()),
      };
    },
    async async(value, ctx) {
      return {
        factory: await ctx.parse(READABLE_STREAM_FACTORY),
        stream: await ctx.parseStreamSource(toAsyncIterable(value)),
      };
    },
    stream(value, ctx) {
      return {
        factory: ctx.parse(READABLE_STREAM_FACTORY),
        stream: ctx.parseStreamSource(toAsyncIterable(value)),
      };
    },
  },
  serialize(node, ctx) {
    return (
      '(' +
      ctx.serialize(node.factory) +
      ')(' +
      ctx.serialize(node.stream) +
      ')'
    );
  },
  deserialize(node, ctx) {
    const stream = ctx.deserialize(node.stream) as Stream<any>;
    return READABLE_STREAM_FACTORY_CONSTRUCTOR(stream);
  },
  binary: {
    serialize(value, ctx) {
      return {
        stream: ctx.streamSource(toAsyncIterable(value)) as Stream<unknown>,
      };
    },
    deserialize(data) {
      return READABLE_STREAM_FACTORY_CONSTRUCTOR(data.stream);
    },
  },
});

export default ReadableStreamPlugin;
