import type { SerovalNode } from 'seroval';
import { createPlugin } from 'seroval';
import {
  expectArrayBuffer,
  expectObject,
  expectOptionalNumber,
  expectOptionalString,
  expectString,
} from './validate';

// Copies only the known fields, each checked, so the constructor never
// converts an input object to a string or a number.
function expectFileOptions(value: unknown): FilePropertyBag {
  const options = expectObject(value);
  return {
    type: expectOptionalString(options.type),
    lastModified: expectOptionalNumber(options.lastModified),
  };
}

type FileNode = {
  name: SerovalNode;
  options: SerovalNode;
  buffer: SerovalNode;
};

const FilePlugin = /* @__PURE__ */ createPlugin<File, FileNode>({
  tag: 'seroval-plugins/web/File',
  skipPlainObjects: true,
  test(value) {
    if (typeof File === 'undefined') {
      return false;
    }
    return value instanceof File;
  },
  parse: {
    async async(value, ctx) {
      return {
        name: await ctx.parse(value.name),
        options: await ctx.parse({
          type: value.type,
          lastModified: value.lastModified,
        }),
        buffer: await ctx.parse(await value.arrayBuffer()),
      };
    },
  },
  serialize(node, ctx) {
    return (
      'new File([' +
      ctx.serialize(node.buffer) +
      '],' +
      ctx.serialize(node.name) +
      ',' +
      ctx.serialize(node.options) +
      ')'
    );
  },
  deserialize(node, ctx) {
    return new File(
      [expectArrayBuffer(ctx.deserialize(node.buffer))],
      expectString(ctx.deserialize(node.name)),
      expectFileOptions(ctx.deserialize(node.options)),
    );
  },
});

export default FilePlugin;
