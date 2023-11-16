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
  // isIterable?: (value: Value) => boolean;
  // isSerializable?: (value: Value) => boolean;
}

export function createPlugin<Value, Node>(
  plugin: Plugin<Value, Node>,
): Plugin<Value, Node> {
  return plugin;
}

export interface PluginAccessOptions {
  plugins?: Plugin<any, any>[];
}
