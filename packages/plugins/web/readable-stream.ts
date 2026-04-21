import type { SerovalNode, Stream } from 'seroval';
import { createPlugin, createStream } from 'seroval';

const READABLE_STREAM_FACTORY = {};

const READABLE_STREAM_FACTORY_CONSTRUCTOR = (stream: Stream<unknown>) =>
  new ReadableStream({
    start: controller => {
      stream.on({
        next: value => {
          try {
            controller.enqueue(value);
          } catch (_error) {
            // no-op
          }
        },
        throw: value => {
          controller.error(value);
        },
        return: () => {
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

async function drainStream<T>(
  stream: Stream<T | undefined>,
  reader: ReadableStreamDefaultReader<T>,
): Promise<void> {
  try {
    const result = await reader.read();
    if (result.done) {
      stream.return(result.value);
      reader.releaseLock();
    } else {
      stream.next(result.value);
      await drainStream(stream, reader);
    }
  } catch (error) {
    stream.throw(error);
  }
}

function cleanupStream<T>(reader: ReadableStreamDefaultReader<T>): void {
  reader.cancel().catch(() => {
    // no-op
  });
  reader.releaseLock();
}

function toStream<T>(
  value: ReadableStream<T>,
): [Stream<T | undefined>, () => void] {
  const stream = createStream<T | undefined>();

  const reader = value.getReader();

  const cleanup = cleanupStream.bind(null, reader);

  drainStream(stream, reader).catch(cleanup);

  return [stream, cleanup];
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
        stream: await ctx.parse(toStream(value)[0]),
      };
    },
    stream(value, ctx) {
      const [stream, cleanup] = toStream(value);
      ctx.addCleanup(cleanup);
      return {
        factory: ctx.parse(READABLE_STREAM_FACTORY),
        stream: ctx.parse(stream),
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
