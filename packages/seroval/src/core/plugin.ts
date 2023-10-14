import type AsyncCrossParserContext from './cross/async';
import type CrossSerializerContext from './cross/serialize';
import type StreamCrossParserContext from './cross/stream';
import type SyncCrossParserContext from './cross/sync';
import type AsyncParserContext from './tree/async';
import type VanillaDeserializerContext from './tree/deserialize';
import type VanillaSerializerContext from './tree/serialize';
import type SyncParserContext from './tree/sync';

export interface PluginData {
  id: number;
  isCross: boolean;
}

export interface Plugin<Value, Node> {
  tag: string;
  test(value: unknown): boolean;
  parse: {
    sync?: (
      value: Value,
      ctx: SyncParserContext | SyncCrossParserContext,
      data: PluginData,
    ) => Node;
    async?: (
      value: Value,
      ctx: AsyncParserContext | AsyncCrossParserContext,
      data: PluginData,
    ) => Promise<Node>;
    stream?: (
      value: Value,
      ctx: StreamCrossParserContext,
      data: PluginData,
    ) => Node;
  };
  serialize(
    node: Node,
    ctx: VanillaSerializerContext | CrossSerializerContext,
    data: PluginData,
  ): string;
  deserialize(
    node: Node,
    ctx: VanillaDeserializerContext,
    data: PluginData,
  ): Value;
  isIterable?: (value: Value) => boolean;
}

export function createPlugin<Value, Node>(
  plugin: Plugin<Value, Node>,
): Plugin<Value, Node> {
  return plugin;
}

export interface PluginAccessOptions {
  plugins?: Plugin<any, any>[];
}

export class PluginAccess {
  /**
   * @private
   */
  plugins?: Plugin<any, any>[];

  constructor(options?: PluginAccessOptions) {
    this.plugins = options?.plugins;
  }
}
