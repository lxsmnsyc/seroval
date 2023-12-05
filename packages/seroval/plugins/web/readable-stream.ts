import { createPlugin } from 'seroval';

export default createPlugin({
  tag: 'seroval/plugins/web/readable-stream',
  test(value) {
    if (typeof ReadableStream === 'undefined') {
      return false;
    }
    return value instanceof ReadableStream;
  },
  parse: {
    sync(value, ctx, data) {

    },
    async(value, ctx, data) {

    },
    stream(value, ctx, data) {
      return ctx.parse()
    },
  },
  serialize(node, ctx, data) {

  },
  deserialize(node, ctx, data) {

  },
});
