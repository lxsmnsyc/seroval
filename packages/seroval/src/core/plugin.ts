import type BaseAsyncParserContext from './context/parser/async';
import type BaseStreamParserContext from './context/parser/stream';
import type BaseSyncParserContext from './context/parser/sync';
import type BaseSerializerContext from './context/serializer';
import type BaseDeserializerContext from './context/deserializer';

export type SerovalMode = 'vanilla' | 'cross';

export interface PluginData {
  id: number;
}

export interface Plugin<Value, Node> {
  tag: string;
  extends?: Plugin<any, any>[];
  test(value: unknown): boolean;
  parse: {
    sync?: (
      value: Value,
      ctx: BaseSyncParserContext,
      data: PluginData,
    ) => Node;
    async?: (
      value: Value,
      ctx: BaseAsyncParserContext,
      data: PluginData,
    ) => Promise<Node>;
    stream?: (
      value: Value,
      ctx: BaseStreamParserContext,
      data: PluginData,
    ) => Node;
  };
  serialize(
    node: Node,
    ctx: BaseSerializerContext,
    data: PluginData,
  ): string;
  deserialize(
    node: Node,
    ctx: BaseDeserializerContext,
    data: PluginData,
  ): Value;
}

export function createPlugin<Value, Node>(
  plugin: Plugin<Value, Node>,
): Plugin<Value, Node> {
  return plugin;
}

export interface PluginAccessOptions {
  plugins?: Plugin<any, any>[];
}

function dedupePlugins(
  deduped: Set<Plugin<any, any>>,
  plugins: Plugin<any, any>[],
): void {
  for (let i = 0, len = plugins.length; i < len; i++) {
    const current = plugins[i];
    if (!deduped.has(current)) {
      deduped.add(current);
      if (current.extends) {
        dedupePlugins(deduped, current.extends);
      }
    }
  }
}

export function resolvePlugins(
  plugins?: Plugin<any, any>[],
): Plugin<any, any>[] | undefined {
  if (plugins) {
    const deduped = new Set<Plugin<any, any>>();
    dedupePlugins(deduped, plugins);
    return [...deduped];
  }
  return undefined;
}
