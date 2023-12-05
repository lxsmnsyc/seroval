import type { SerovalNode, Stream } from 'seroval';
import { createPlugin, createStream } from 'seroval';

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
  stream: SerovalNode;
}

export default createPlugin<ReadableStream, ReadableStreamNode>({
  tag: 'seroval/plugins/web/readable-stream',
  test(value) {
    if (typeof ReadableStream === 'undefined') {
      return false;
    }
    return value instanceof ReadableStream;
  },
  parse: {
    sync(value, ctx, data) {
      return {
        stream: ctx.parse(createStream()),
      };
    },
    async async(value, ctx, data) {
      return {
        stream: await ctx.parse(toStream(value)),
      };
    },
    stream(value, ctx, data) {
      return {
        stream: ctx.parse(toStream(value)),
      };
    },
  },
  serialize(node, ctx, data) {

  },
  deserialize(node, ctx, data) {

  },
});
