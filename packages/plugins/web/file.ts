import type { SerovalNode } from 'seroval';
import { createPlugin } from 'seroval';
import * as v from 'seroval/validator';

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
  validate: { name: v.string, buffer: v.arrayBuffer },
  deserialize(node, ctx) {
    return new File(
      [ctx.deserialize<ArrayBuffer>(node.buffer)],
      ctx.deserialize<string>(node.name),
      ctx.deserialize<FilePropertyBag>(node.options),
    );
  },
});

export default FilePlugin;
