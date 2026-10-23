import type { SerovalNode } from 'seroval';
import { createPlugin } from 'seroval';
import * as v from 'seroval/validator';

type ImageDataNode = {
  data: SerovalNode;
  width: SerovalNode;
  height: SerovalNode;
  options: SerovalNode;
};

const ImageDataPlugin = /* @__PURE__ */ createPlugin<ImageData, ImageDataNode>({
  tag: 'seroval-plugins/web/ImageData',
  skipPlainObjects: true,
  test(value) {
    if (typeof ImageData === 'undefined') {
      return false;
    }
    return value instanceof ImageData;
  },
  parse: {
    sync(value, ctx) {
      return {
        data: ctx.parse(value.data),
        width: ctx.parse(value.width),
        height: ctx.parse(value.height),
        options: ctx.parse({
          colorSpace: value.colorSpace,
        }),
      };
    },
    async async(value, ctx) {
      return {
        data: await ctx.parse(value.data),
        width: await ctx.parse(value.width),
        height: await ctx.parse(value.height),
        options: await ctx.parse({
          colorSpace: value.colorSpace,
        }),
      };
    },
    stream(value, ctx) {
      return {
        data: ctx.parse(value.data),
        width: ctx.parse(value.width),
        height: ctx.parse(value.height),
        options: ctx.parse({
          colorSpace: value.colorSpace,
        }),
      };
    },
  },
  serialize(node, ctx) {
    return (
      'new ImageData(' +
      ctx.serialize(node.data) +
      ',' +
      ctx.serialize(node.width) +
      ',' +
      ctx.serialize(node.height) +
      ',' +
      ctx.serialize(node.options) +
      ')'
    );
  },
  validate: { width: v.number, height: v.number },
  deserialize(node, ctx) {
    return new ImageData(
      ctx.deserialize<Uint8ClampedArray<ArrayBuffer>>(node.data),
      ctx.deserialize<number>(node.width),
      ctx.deserialize<number>(node.height),
      ctx.deserialize<ImageDataSettings>(node.options),
    );
  },
});

export default ImageDataPlugin;
