import type { SerovalNode } from 'seroval';
import { createPlugin } from 'seroval';
import FilePlugin from './file';

type FormDataInit = [key: string, value: FormDataEntryValue][];

function convertFormData(instance: FormData): FormDataInit {
  const items: FormDataInit = [];
  // biome-ignore lint/complexity/noForEach: <explanation>
  instance.forEach((value, key) => {
    items.push([key, value]);
  });
  return items;
}

const FORM_DATA_FACTORY = {};

const FormDataFactoryPlugin = /* @__PURE__ */ createPlugin<object, undefined>({
  tag: 'seroval-plugins/web/FormDataFactory',
  test(value) {
    return value === FORM_DATA_FACTORY;
  },
  parse: {
    sync() {
      return undefined;
    },
    async async() {
      return await Promise.resolve(undefined);
    },
    stream() {
      return undefined;
    },
  },
  serialize(_node, ctx) {
    return ctx.createEffectfulFunction(
      ['e', 'f', 'i', 's', 't'],
      'f=new FormData;for(i=0,s=e.length;i<s;i++)f.append((t=e[i])[0],t[1]);return f',
    );
  },
  deserialize() {
    return FORM_DATA_FACTORY;
  },
});

interface FormDataNode {
  factory: SerovalNode;
  entries: SerovalNode;
}

const FormDataPlugin = /* @__PURE__ */ createPlugin<FormData, FormDataNode>({
  tag: 'seroval-plugins/web/FormData',
  extends: [FilePlugin, FormDataFactoryPlugin],
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
    return (
      '(' +
      ctx.serialize(node.factory) +
      ')(' +
      ctx.serialize(node.entries) +
      ')'
    );
  },
  deserialize(node, ctx) {
    const instance = new FormData();
    const entries = ctx.deserialize(node.entries) as FormDataInit;
    for (let i = 0, len = entries.length; i < len; i++) {
      const entry = entries[i];
      instance.append(entry[0], entry[1]);
    }
    return instance;
  },
});

export default FormDataPlugin;
