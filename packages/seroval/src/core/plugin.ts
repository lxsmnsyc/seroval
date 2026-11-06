import type { BinarySerializerPluginContext } from '../binary/serializer';
import type { AsyncParsePluginContext } from './context/async-parser';
import type { DeserializePluginContext } from './context/deserializer';
import type { SerializePluginContext } from './context/serializer';
import type { StreamParsePluginContext } from './context/stream-parser';
import type { SyncParsePluginContext } from './context/sync-parser';
import type { SerovalNode } from './types';
import type { Validator } from './validator';

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
  // oxlint-disable-next-line no-explicit-any -- Plugin is invariant, so any is needed to hold every plugin.
  extends?: Plugin<any, any>[];
  /**
   * Method to test if a value is an expected value of the plugin
   * @param value
   */
  test(value: unknown): boolean;
  /**
   * Set to `true` if `test` never returns `true` for a plain object, whose
   * prototype is `Object.prototype`, such as an object literal. The parsers
   * then skip this plugin for those objects. Leave it unset if unsure. A
   * plugin that sets it is never applied to such objects.
   */
  skipPlainObjects?: boolean;
  /**
   * Parsing modes
   */
  parse: {
    sync?: (value: Value, ctx: SyncParsePluginContext, data: PluginData) => Info;
    async?: (value: Value, ctx: AsyncParsePluginContext, data: PluginData) => Promise<Info>;
    stream?: (value: Value, ctx: StreamParsePluginContext, data: PluginData) => Info;
  };
  /**
   * Convert the parsed node into a JS string
   */
  serialize(node: Info, ctx: SerializePluginContext, data: PluginData): string;
  /**
   * Validators for the fields of a node, by field name. The fields come from
   * input that may be untrusted. When `deserialize` reads a listed field with
   * `ctx.deserialize`, the decoded value is checked before it is returned, and
   * `SerovalPluginValidationError` is thrown if the check fails. Fields that
   * are not listed, or that `deserialize` never reads, are not checked.
   *
   * It applies to `fromJSON`, `fromCrossJSON` and `createCrossDeserializer`.
   * Build the validators from the `v` helpers, for example
   * `{ type: v.string }`.
   */
  validate?: { [K in keyof Info]?: Validator<unknown> };
  /**
   * Convert the parsed node into its runtime equivalent.
   */
  deserialize(node: Info, ctx: DeserializePluginContext, data: PluginData): Value;
}

/**
 * The binary-mode half of a plugin, used by the `binary` serializer/
 * deserializer. It converts a value to and from a `BinaryData` payload that
 * seroval itself knows how to encode.
 */
export interface BinaryPlugin<Value, BinaryData> {
  /** Reduces a value to a serializable `BinaryData` payload. */
  serialize(value: Value, ctx: BinarySerializerPluginContext): BinaryData;
  /**
   * Validators for the fields of the decoded payload, by field name. The
   * payload comes from input that may be untrusted. Each listed field is
   * checked before `deserialize` runs, and `SerovalPluginValidationError` is
   * thrown if a check fails. Fields that are not listed are not checked.
   */
  validate?: { [K in keyof BinaryData]?: Validator<unknown> };
  /** Rebuilds the value from its `BinaryData` payload, possibly asynchronously. */
  deserialize(value: BinaryData): Value | Promise<Value>;
}

/** A {@link Plugin} that also supports binary mode via a {@link BinaryPlugin}. */
export interface PluginWithBinaryMode<Value, Info extends PluginInfo, BinaryData> extends Plugin<
  Value,
  Info
> {
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
  // oxlint-disable-next-line no-explicit-any -- Plugin is invariant, so any is needed to hold every plugin.
  plugins?: Plugin<any, any>[];
}

function dedupePlugins(
  // oxlint-disable-next-line no-explicit-any -- Plugin is invariant, so any is needed to hold every plugin.
  deduped: Set<Plugin<any, any>>,
  // oxlint-disable-next-line no-explicit-any -- Plugin is invariant, so any is needed to hold every plugin.
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

// Resolved lists by input array. Callers usually pass the same array on every
// call, so this skips the Set and array allocation of each resolve.
// oxlint-disable-next-line no-explicit-any -- Plugin is invariant, so any is needed to hold every plugin.
const RESOLVED_PLUGINS = /* @__PURE__ */ new WeakMap<Plugin<any, any>[], Plugin<any, any>[]>();

// Checks that resolving `plugins` again gives exactly `resolved`. It walks the
// same order as `dedupePlugins`, so a changed input array or `extends` list
// fails the check and the list is resolved again.
function matchResolved(
  // oxlint-disable-next-line no-explicit-any -- Plugin is invariant, so any is needed to hold every plugin.
  resolved: Plugin<any, any>[],
  // oxlint-disable-next-line no-explicit-any -- Plugin is invariant, so any is needed to hold every plugin.
  plugins: Plugin<any, any>[],
  added: number,
): number {
  for (let i = 0, len = plugins.length; i < len; i++) {
    const current = plugins[i];
    if (current === resolved[added]) {
      // `dedupePlugins` adds it here, as the next new plugin.
      added++;
      if (current.extends) {
        added = matchResolved(resolved, current.extends, added);
        if (added === -1) {
          return -1;
        }
      }
    } else {
      const index = resolved.indexOf(current);
      if (index === -1 || index >= added) {
        return -1;
      }
    }
  }
  return added;
}

export function resolvePlugins(
  // oxlint-disable-next-line no-explicit-any -- Plugin is invariant, so any is needed to hold every plugin.
  plugins?: PluginWithBinaryMode<any, any, any>[],
  // oxlint-disable-next-line no-explicit-any -- Plugin is invariant, so any is needed to hold every plugin.
): PluginWithBinaryMode<any, any, any>[] | undefined;
export function resolvePlugins(
  // oxlint-disable-next-line no-explicit-any -- Plugin is invariant, so any is needed to hold every plugin.
  plugins?: Plugin<any, any>[],
  // oxlint-disable-next-line no-explicit-any -- Plugin is invariant, so any is needed to hold every plugin.
): Plugin<any, any>[] | undefined;
export function resolvePlugins(
  // oxlint-disable-next-line no-explicit-any -- Plugin is invariant, so any is needed to hold every plugin.
  plugins?: Plugin<any, any>[],
  // oxlint-disable-next-line no-explicit-any -- Plugin is invariant, so any is needed to hold every plugin.
): Plugin<any, any>[] | undefined {
  if (plugins) {
    const cached = RESOLVED_PLUGINS.get(plugins);
    if (cached && matchResolved(cached, plugins, 0) === cached.length) {
      return cached;
    }
    // oxlint-disable-next-line no-explicit-any -- Plugin is invariant, so any is needed to hold every plugin.
    const deduped = new Set<Plugin<any, any>>();
    dedupePlugins(deduped, plugins);
    const resolved = [...deduped];
    RESOLVED_PLUGINS.set(plugins, resolved);
    return resolved;
  }
  return undefined;
}

/**
 * Returns the plugins that are tested for plain objects. It is the same array
 * when no plugin sets `skipPlainObjects`.
 */
// oxlint-disable-next-line no-explicit-any -- Plugin is invariant, so any is needed to hold every plugin.
export function getPlainObjectPlugins<P extends Plugin<any, any>>(
  plugins: P[] | undefined,
): P[] | undefined {
  if (plugins) {
    for (let i = 0, len = plugins.length; i < len; i++) {
      if (plugins[i].skipPlainObjects) {
        const result = plugins.filter((plugin) => !plugin.skipPlainObjects);
        return result.length ? result : undefined;
      }
    }
  }
  return plugins;
}
