import { createPlugin, type SerovalNode } from '..';

const BufferPlugin = createPlugin<Buffer, SerovalNode>({
  tag: 'Buffer',
  test(value) {
    return value instanceof Buffer;
  },
  parse: {
    sync(value, ctx) {
      return ctx.parse(value.toString('base64'));
    },
    async async(value, ctx) {
      return ctx.parse(value.toString('base64'));
    },
    stream(value, ctx) {
      return ctx.parse(value.toString('base64'));
    },
  },
  serialize(node, ctx) {
    return `Buffer.from(${ctx.serialize(node)}, "base64")`;
  },
  deserialize(node, ctx) {
    return Buffer.from(ctx.deserialize(node) as string, 'base64');
  },
});
