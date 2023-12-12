import type { SerovalNode, Stream } from 'seroval';
import { createPlugin, createStream } from 'seroval';

const READABLE_STREAM_FACTORY = {};

const ReadableStreamFactoryPlugin = /* @__PURE__ */ createPlugin<
  object,
  undefined
>({
  tag: 'seroval-plugins/web/ReadableStreamFactory',
  test(value) {
    return value === READABLE_STREAM_FACTORY;
  },
  parse: {
    sync() {
      return undefined;
    },
    async async() {
      return await Promise.resolve(undefined);
    },
    stream() {
      return undefined;
    },
  },
  serialize(_node, ctx) {
    return ctx.createFunction(
      ['d'],
      'new ReadableStream({start:' +
        ctx.createEffectfulFunction(
          ['c'],
          'd.on({next:' +
            ctx.createEffectfulFunction(['v'], 'c.enqueue(v)') +
            ',throw:' +
            ctx.createEffectfulFunction(['v'], 'c.error(v)') +
            ',return:' +
            ctx.createEffectfulFunction([], 'c.close()') +
            '})',
        ) +
        '})',
    );
  },
  deserialize() {
    return READABLE_STREAM_FACTORY;
  },
});

function toStream<T>(value: ReadableStream<T>): Stream<T | undefined> {
  const stream = createStream<T | undefined>();

  const reader = value.getReader();

  async function push(): Promise<void> {
    try {
      const result = await reader.read();
      if (result.done) {
        stream.return(result.value);
      } else {
        stream.next(result.value);
        await push();
      }
    } catch (error) {
      stream.throw(error);
    }
  }

  push().catch(() => {
    //
  });

  return stream;
}

interface ReadableStreamNode {
  factory: SerovalNode;
  stream: SerovalNode;
}

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
        stream: await ctx.parse(toStream(value)),
      };
    },
    stream(value, ctx) {
      return {
        factory: ctx.parse(READABLE_STREAM_FACTORY),
        stream: ctx.parse(toStream(value)),
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
    return new ReadableStream({
      start(controller): void {
        stream.on({
          next(value) {
            controller.enqueue(value);
          },
          throw(value) {
            controller.error(value);
          },
          return() {
            controller.close();
          },
        });
      },
    });
  },
});

export default ReadableStreamPlugin;
