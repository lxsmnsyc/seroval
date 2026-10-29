import type { SerovalNode } from 'seroval';
import { SerovalPluginValidationError, createPlugin } from 'seroval';
import * as v from 'seroval/validator';

type FileNode = {
  name: SerovalNode;
  options: SerovalNode;
  buffer: SerovalNode;
};

type FileBinaryData = {
  name: string;
  options: {
    type: string;
    lastModified: number;
  };
  buffer: Promise<ArrayBuffer>;
};

const FilePlugin = /* @__PURE__ */ createPlugin<File, FileNode, FileBinaryData>({
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
  binary: {
    serialize(value) {
      return {
        name: value.name,
        options: {
          type: value.type,
          lastModified: value.lastModified,
        },
        buffer: value.arrayBuffer(),
      };
    },
    validate: { name: v.string, buffer: /* @__PURE__ */ v.instanceOf(Promise) },
    async deserialize(data) {
      // `buffer` is checked to be a Promise, but what it resolves to is only
      // known here.
      const buffer: unknown = await data.buffer;
      if (!(buffer instanceof ArrayBuffer)) {
        throw new SerovalPluginValidationError('seroval-plugins/web/File', 'buffer');
      }
      return new File([buffer], data.name, data.options);
    },
  },
});

export default FilePlugin;
