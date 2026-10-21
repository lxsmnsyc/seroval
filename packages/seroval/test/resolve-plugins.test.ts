import { describe, expect, it } from 'vitest';
import type { Plugin } from '../src';
import { createPlugin } from '../src';
import { resolvePlugins } from '../src/core/plugin';

// oxlint-disable-next-line no-explicit-any -- Plugin is invariant, so any is needed to hold every plugin.
type AnyPlugin = Plugin<any, any>;

function makePlugin(tag: string, extendsList?: AnyPlugin[]): AnyPlugin {
  return createPlugin({
    tag,
    extends: extendsList,
    test: () => false,
    parse: {},
    serialize: () => '',
    deserialize: () => undefined,
  });
}

function tags(plugins: AnyPlugin[] | undefined): string[] | undefined {
  return plugins?.map((plugin) => plugin.tag);
}

describe('resolvePlugins', () => {
  it('returns undefined without plugins', () => {
    expect(resolvePlugins()).toBeUndefined();
  });

  it('dedupes plugins and their dependencies in order', () => {
    const a = makePlugin('a');
    const b = makePlugin('b', [a]);
    const c = makePlugin('c', [b, a]);
    expect(tags(resolvePlugins([c, a, b, c]))).toStrictEqual(['c', 'b', 'a']);
  });

  it('reuses the result for the same array', () => {
    const a = makePlugin('a');
    const b = makePlugin('b', [a]);
    const plugins = [b, a];
    const first = resolvePlugins(plugins);
    expect(resolvePlugins(plugins)).toBe(first);
    expect(tags(first)).toStrictEqual(['b', 'a']);
  });

  it('resolves again after the array changes', () => {
    const a = makePlugin('a');
    const b = makePlugin('b');
    const c = makePlugin('c');
    const plugins = [a, b];
    expect(tags(resolvePlugins(plugins))).toStrictEqual(['a', 'b']);
    plugins.push(c);
    expect(tags(resolvePlugins(plugins))).toStrictEqual(['a', 'b', 'c']);
    plugins[0] = c;
    expect(tags(resolvePlugins(plugins))).toStrictEqual(['c', 'b']);
    plugins.length = 1;
    expect(tags(resolvePlugins(plugins))).toStrictEqual(['c']);
    plugins.push(c);
    expect(tags(resolvePlugins(plugins))).toStrictEqual(['c']);
    plugins.reverse();
    plugins.unshift(a);
    expect(tags(resolvePlugins(plugins))).toStrictEqual(['a', 'c']);
  });

  it('resolves again after a dependency list changes', () => {
    const a = makePlugin('a');
    const b = makePlugin('b');
    const dependencies: AnyPlugin[] = [a];
    const c = makePlugin('c', dependencies);
    const plugins = [c];
    expect(tags(resolvePlugins(plugins))).toStrictEqual(['c', 'a']);
    dependencies.push(b);
    expect(tags(resolvePlugins(plugins))).toStrictEqual(['c', 'a', 'b']);
    c.extends = [b];
    expect(tags(resolvePlugins(plugins))).toStrictEqual(['c', 'b']);
    c.extends = undefined;
    expect(tags(resolvePlugins(plugins))).toStrictEqual(['c']);
    c.extends = [a];
    expect(tags(resolvePlugins(plugins))).toStrictEqual(['c', 'a']);
  });
});
