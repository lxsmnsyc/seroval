import type { SerovalNode } from 'seroval';
import { SerovalPluginValidationError, createPlugin } from 'seroval';
import * as v from 'seroval/validator';

// Each known field is checked, so the constructor never converts an input
// object to a string or a number.
const isFileOptions = /* @__PURE__ */ v.object({
  type: /* @__PURE__ */ v.optional(v.string),
  lastModified: /* @__PURE__ */ v.optional(v.number),
});

// Copies only the known fields, so the constructor never reads one the
// validator skipped.
function copyFileOptions(options: FilePropertyBag): FilePropertyBag {
  return {
    type: options.type,
    lastModified: options.lastModified,
  };
}

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
  validate: {
    name: v.string,
    options: isFileOptions,
    buffer: /* @__PURE__ */ v.instanceOf(ArrayBuffer),
  },
  deserialize(node, ctx) {
    return new File(
      [ctx.deserialize<ArrayBuffer>(node.buffer)],
      ctx.deserialize<string>(node.name),
      copyFileOptions(ctx.deserialize<FilePropertyBag>(node.options)),
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
    validate: {
      name: v.string,
      options: isFileOptions,
      buffer: /* @__PURE__ */ v.instanceOf(Promise),
    },
    async deserialize(data) {
      // `buffer` is checked to be a Promise, but what it resolves to is only
      // known here.
      const buffer: unknown = await data.buffer;
      if (!(buffer instanceof ArrayBuffer)) {
        throw new SerovalPluginValidationError('seroval-plugins/web/File', 'buffer');
      }
      return new File([buffer], data.name, copyFileOptions(data.options));
    },
  },
});

export default FilePlugin;
