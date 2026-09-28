import type { LiveStream, SerovalNode, Stream } from 'seroval';
import { createLiveStream, createPlugin, createStream } from 'seroval';

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

const ReadableStreamFactoryPlugin = /* @__PURE__ */ createPlugin<object, {}>({
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
});

/**
 * Each chunk is read only after the previous one has been accepted: by the
 * serializer's output in streaming mode, or by the collector in async mode.
 * The source never runs ahead of its destination.
 */
function toLiveStream<T>(value: ReadableStream<T>): LiveStream<T | undefined> {
  const reader = value.getReader();
  let active = true;

  const { stream, producer } = createLiveStream<T | undefined>({
    onCancel(reason) {
      if (active) {
        active = false;
        reader.cancel(reason).catch(() => {
          // no-op
        });
      }
    },
  });

  async function pump(): Promise<void> {
    try {
      while (active) {
        const result = await reader.read();
        if (!active) {
          return;
        }
        if (result.done) {
          active = false;
          await producer.close(result.value);
          return;
        }
        await producer.write(result.value);
      }
    } catch (error) {
      if (active) {
        active = false;
        await producer.fail(error);
      }
    } finally {
      try {
        reader.releaseLock();
      } catch (_error) {
        // no-op
      }
    }
  }

  pump().catch(() => {
    // no-op
  });

  return stream;
}

type ReadableStreamNode = {
  factory: SerovalNode;
  stream: SerovalNode;
};

const ReadableStreamPlugin = /* @__PURE__ */ createPlugin<
  ReadableStream,
  ReadableStreamNode
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
        stream: await ctx.parse(toLiveStream(value)),
      };
    },
    stream(value, ctx) {
      return {
        factory: ctx.parse(READABLE_STREAM_FACTORY),
        stream: ctx.parse(toLiveStream(value)),
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
});

export default ReadableStreamPlugin;
