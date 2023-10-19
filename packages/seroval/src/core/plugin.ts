import type BaseAsyncParserContext from './base/async';
import type BaseStreamParserContext from './base/stream';
import type BaseSyncParserContext from './base/sync';
import type BaseSerializerContext from './serializer-context.old';
import type VanillaDeserializerContext from './tree/deserialize';

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
    ctx: VanillaDeserializerContext,
    data: PluginData,
  ): Value;
  isIterable?: (value: Value) => boolean;
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
