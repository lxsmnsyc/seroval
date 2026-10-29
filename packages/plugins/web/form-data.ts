import type { SerovalNode } from 'seroval';
import { createPlugin } from 'seroval';
import FilePlugin from './file';
import { copyEntries, entries } from './validate';

type FormDataInit = [key: string, value: FormDataEntryValue][];

function isFormDataEntryValue(value: unknown): value is FormDataEntryValue {
  return typeof value === 'string' || value instanceof Blob;
}

const isFormDataInit = /* @__PURE__ */ entries(isFormDataEntryValue);

function convertFormData(instance: FormData): FormDataInit {
  const items: FormDataInit = [];
  instance.forEach((value, key) => {
    items.push([key, value]);
  });
  return items;
}

const FORM_DATA_FACTORY = {};

const FORM_DATA_FACTORY_CONSTRUCTOR = (
  e: [key: string, value: FormDataEntryValue][],
  f = new FormData(),
  i = 0,
  s = e.length,
  t?: [key: string, value: FormDataEntryValue],
): FormData => {
  for (; i < s; i++) {
    t = e[i];
    f.append(t[0], t[1]);
  }
  return f;
};

const FormDataFactoryPlugin = /* @__PURE__ */ createPlugin<
  object,
  Record<string, never>,
  Record<string, never>
>({
  tag: 'seroval-plugins/web/FormDataFactory',
  test(value) {
    return value === FORM_DATA_FACTORY;
  },
  parse: {
    sync() {
      return FORM_DATA_FACTORY;
    },
    async async() {
      return await Promise.resolve(FORM_DATA_FACTORY);
    },
    stream() {
      return FORM_DATA_FACTORY;
    },
  },
  serialize() {
    return FORM_DATA_FACTORY_CONSTRUCTOR.toString();
  },
  deserialize() {
    return FORM_DATA_FACTORY;
  },
  binary: {
    serialize() {
      return FORM_DATA_FACTORY;
    },
    deserialize() {
      return FORM_DATA_FACTORY;
    },
  },
});

type FormDataNode = {
  factory: SerovalNode;
  entries: SerovalNode;
};

type FormDataBinaryData = {
  entries: FormDataInit;
};

const FormDataPlugin = /* @__PURE__ */ createPlugin<FormData, FormDataNode, FormDataBinaryData>({
  tag: 'seroval-plugins/web/FormData',
  extends: [FilePlugin, FormDataFactoryPlugin],
  skipPlainObjects: true,
  test(value) {
    if (typeof FormData === 'undefined') {
      return false;
    }
    return value instanceof FormData;
  },
  parse: {
    sync(value, ctx) {
      return {
        factory: ctx.parse(FORM_DATA_FACTORY),
        entries: ctx.parse(convertFormData(value)),
      };
    },
    async async(value, ctx) {
      return {
        factory: await ctx.parse(FORM_DATA_FACTORY),
        entries: await ctx.parse(convertFormData(value)),
      };
    },
    stream(value, ctx) {
      return {
        factory: ctx.parse(FORM_DATA_FACTORY),
        entries: ctx.parse(convertFormData(value)),
      };
    },
  },
  serialize(node, ctx) {
    return '(' + ctx.serialize(node.factory) + ')(' + ctx.serialize(node.entries) + ')';
  },
  validate: { entries: isFormDataInit },
  deserialize(node, ctx) {
    return FORM_DATA_FACTORY_CONSTRUCTOR(copyEntries(ctx.deserialize<FormDataInit>(node.entries)));
  },
  binary: {
    serialize(value) {
      return {
        entries: convertFormData(value),
      };
    },
    validate: { entries: isFormDataInit },
    deserialize(data) {
      return FORM_DATA_FACTORY_CONSTRUCTOR(copyEntries(data.entries));
    },
  },
});

export default FormDataPlugin;
