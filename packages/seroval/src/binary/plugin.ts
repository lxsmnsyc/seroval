export type PluginData = Record<string, unknown>;

export interface Plugin<Value, Data extends PluginData> {
  tag: string;
  test(value: unknown): value is Value;
  serialize(value: Value): Data;
  deserialize(data: Data): Value;
}

export function createPlugin<Value, Data extends PluginData>(
  plugin: Plugin<Value, Data>,
): Plugin<Value, Data> {
  return plugin;
}
