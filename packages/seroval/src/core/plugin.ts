import type AsyncCrossParserContext from './cross/async';
import type CrossSerializerContext from './cross/serialize';
import type StreamCrossParserContext from './cross/stream';
import type SyncCrossParserContext from './cross/sync';
import type AsyncParserContext from './tree/async';
import type VanillaDeserializerContext from './tree/deserialize';
import type VanillaSerializerContext from './tree/serialize';
import type SyncParserContext from './tree/sync';

export type SerializableNode =
  | number
  | boolean
  | string
  | null
  | SerializableNode[]
  | readonly SerializableNode[]
  | { [key: string | number]: SerializableNode }
  | { readonly [key: string | number]: SerializableNode };

export interface Plugin<Value, Node extends SerializableNode = SerializableNode> {
  tag: string;
  test(value: unknown): boolean;
  sync?: (
    value: Value,
    id: number,
    ctx: SyncParserContext | SyncCrossParserContext,
    isCross: boolean,
  ) => Node;
  async?: (
    value: Value,
    id: number,
    ctx: AsyncParserContext | AsyncCrossParserContext,
    isCross: boolean,
  ) => Promise<Node>;
  stream?: (
    value: Value,
    id: number,
    ctx: StreamCrossParserContext,
    isCross: boolean,
  ) => Node;
  serialize(
    node: Node,
    id: number,
    ctx: VanillaSerializerContext | CrossSerializerContext,
    isCross: boolean,
  ): string;
  deserialize(
    node: Node,
    id: number,
    ctx: VanillaDeserializerContext,
    isCross: boolean,
  ): Value;
  isIterable?: (value: Value) => boolean;
}

export function createPlugin<Value, Node extends SerializableNode = SerializableNode>(
  plugin: Plugin<Value, Node>,
): Plugin<Value, Node> {
  return plugin;
}

export interface PluginAccessOptions {
  plugins?: Plugin<unknown>[];
}

export class PluginAccess {
  /**
   * @private
   */
  plugins?: Plugin<unknown>[];

  constructor(options?: PluginAccessOptions) {
    this.plugins = options?.plugins;
  }
}
