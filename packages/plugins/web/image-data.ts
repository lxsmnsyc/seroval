import type { SerovalNode } from 'seroval';
import { createPlugin } from 'seroval';
import { expectNumber, expectObject, expectOptionalString } from './validate';

// The constructor converts any other first argument to a number, which calls
// its `valueOf`.
function expectImageDataArray(value: unknown): Uint8ClampedArray<ArrayBuffer> {
  if (!(value instanceof Uint8ClampedArray)) {
    throw new Error('Expected a Uint8ClampedArray.');
  }
  return value as Uint8ClampedArray<ArrayBuffer>;
}

// Copies only the known fields, each checked, so the constructor never
// converts an input object to a string.
function expectImageDataSettings(value: unknown): ImageDataSettings {
  const options = expectObject(value);
  return {
    colorSpace: expectOptionalString(options.colorSpace) as PredefinedColorSpace | undefined,
  };
}

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
  deserialize(node, ctx) {
    return new ImageData(
      expectImageDataArray(ctx.deserialize(node.data)),
      expectNumber(ctx.deserialize(node.width)),
      expectNumber(ctx.deserialize(node.height)),
      expectImageDataSettings(ctx.deserialize(node.options)),
    );
  },
});

export default ImageDataPlugin;
