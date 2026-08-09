import type { BinarySerializerPluginContext } from '../binary/serializer';
import type { AsyncParsePluginContext } from './context/async-parser';
import type { DeserializePluginContext } from './context/deserializer';
import type { SerializePluginContext } from './context/serializer';
import type {
  StreamParsePluginContext,
  SyncParsePluginContext,
} from './context/sync-parser';
import type { SerovalNode } from './types';

export const enum SerovalMode {
  Vanilla = 1,
  Cross = 2,
}

export interface PluginData {
  id: number;
}

export type PluginInfo = {
  [key: string]: SerovalNode;
};

/**
 * Teaches seroval to (de)serialize a type it does not support natively. A
 * plugin recognizes its values with {@link Plugin.test}, breaks them down into
 * a serializable {@link PluginInfo} during `parse`, and rebuilds them in
 * {@link Plugin.serialize} (to a JS string) and {@link Plugin.deserialize} (to a
 * runtime value). Register plugins through the `plugins` option on any
 * serializer or deserializer.
 *
 * @typeParam Value The runtime type the plugin handles.
 * @typeParam Info The intermediate, serializable shape produced during parsing.
 */
export interface Plugin<Value, Info extends PluginInfo> {
  /**
   * A unique string that helps idenfity the plugin
   */
  tag: string;
  /**
   * List of dependency plugins
   */
  extends?: Plugin<any, any>[];
  /**
   * Method to test if a value is an expected value of the plugin
   * @param value
   */
  test(value: unknown): boolean;
  /**
   * Parsing modes
   */
  parse: {
    sync?: (
      value: Value,
      ctx: SyncParsePluginContext,
      data: PluginData,
    ) => Info;
    async?: (
      value: Value,
      ctx: AsyncParsePluginContext,
      data: PluginData,
    ) => Promise<Info>;
    stream?: (
      value: Value,
      ctx: StreamParsePluginContext,
      data: PluginData,
    ) => Info;
  };
  /**
   * Convert the parsed node into a JS string
   */
  serialize(node: Info, ctx: SerializePluginContext, data: PluginData): string;
  /**
   * Convert the parsed node into its runtime equivalent.
   */
  deserialize(
    node: Info,
    ctx: DeserializePluginContext,
    data: PluginData,
  ): Value;
}

/**
 * The binary-mode half of a plugin, used by the `binary` serializer/
 * deserializer. It converts a value to and from a `BinaryData` payload that
 * seroval itself knows how to encode.
 */
export interface BinaryPlugin<Value, BinaryData> {
  /** Reduces a value to a serializable `BinaryData` payload. */
  serialize(value: Value, ctx: BinarySerializerPluginContext): BinaryData;
  /** Rebuilds the value from its `BinaryData` payload, possibly asynchronously. */
  deserialize(value: BinaryData): Value | Promise<Value>;
}

/** A {@link Plugin} that also supports binary mode via a {@link BinaryPlugin}. */
export interface PluginWithBinaryMode<
  Value,
  Info extends PluginInfo,
  BinaryData,
> extends Plugin<Value, Info> {
  extends?: PluginWithBinaryMode<any, any, any>[];
  binary: BinaryPlugin<Value, BinaryData>;
}

/**
 * Identity helper that defines a plugin with full type inference. Returns the
 * plugin unchanged; its only job is to bind the `Value`/`Info`/`BinaryData`
 * type parameters so the `parse`, `serialize` and `deserialize` callbacks are
 * checked against each other.
 */
export function createPlugin<Value, Info extends PluginInfo>(
  plugin: Plugin<Value, Info>,
): Plugin<Value, Info>;
export function createPlugin<Value, Info extends PluginInfo, BinaryData>(
  plugin: PluginWithBinaryMode<Value, Info, BinaryData>,
): PluginWithBinaryMode<Value, Info, BinaryData>;
export function createPlugin(plugin: unknown) {
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
  plugins?: PluginWithBinaryMode<any, any, any>[],
): PluginWithBinaryMode<any, any, any>[] | undefined;
export function resolvePlugins(
  plugins?: Plugin<any, any>[],
): Plugin<any, any>[] | undefined;
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
