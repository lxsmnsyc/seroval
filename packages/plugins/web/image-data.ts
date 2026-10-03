import type { SerovalNode } from 'seroval';
import { createPlugin } from 'seroval';

type ImageDataNode = {
  data: SerovalNode;
  width: SerovalNode;
  height: SerovalNode;
  options: SerovalNode;
};

type ImageDataBinaryData = {
  data: ImageDataArray;
  width: number;
  height: number;
  options: {
    colorSpace: PredefinedColorSpace;
  };
};

const ImageDataPlugin = /* @__PURE__ */ createPlugin<
  ImageData,
  ImageDataNode,
  ImageDataBinaryData
>({
  tag: 'seroval-plugins/web/ImageData',
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
  deserialize(node, ctx) {
    return new ImageData(
      ctx.deserialize(node.data) as Uint8ClampedArray<ArrayBuffer>,
      ctx.deserialize(node.width) as number,
      ctx.deserialize(node.height) as number,
      ctx.deserialize(node.options) as ImageDataSettings,
    );
  },
  binary: {
    serialize(value) {
      return {
        data: value.data,
        width: value.width,
        height: value.height,
        options: {
          colorSpace: value.colorSpace,
        },
      };
    },
    deserialize(data) {
      return new ImageData(data.data, data.width, data.height, data.options);
    },
  },
});

export default ImageDataPlugin;
