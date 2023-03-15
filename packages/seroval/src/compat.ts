/* eslint-disable guard-for-in */
/**
 * References
 * - https://kangax.github.io/compat-table/es6/
 * - MDN
 * - ESBuild
 */

import assert from './assert';

export type Version = [major: number, minor: number, patch: number];

function compareVersion(left: Version, right: Version) {
  let diff = left[0] - right[0];
  if (diff === 0) {
    diff = left[1] - right[1];
  }
  if (diff === 0) {
    diff = left[2] - right[2];
  }
  return diff;
}

export interface PlatformVersion {
  es: Version;
  // desktop
  chrome?: Version;
  edge?: Version;
  safari?: Version;
  firefox?: Version;
  opera?: Version;
  // mobile
  ios?: Version;
  samsung?: Version;
  // js runtimes
  deno?: Version;
  node?: Version;
}

export type Platform = keyof PlatformVersion;

export const enum Feature {
  AggregateError = 0x01,
  ArrayPrototypeValues = 0x02,
  ArrowFunction = 0x04,
  BigInt = 0x08,
  Map = 0x10,
  MethodShorthand = 0x20,
  ObjectAssign = 0x40,
  Promise = 0x80,
  Set = 0x100,
  SymbolIterator = 0x200,
  TypedArray = 0x400,
  BigIntTypedArray = 0x800,
}

type VersionTable = {
  [key in Feature]: PlatformVersion;
}

const VERSION_TABLE: VersionTable = {
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AggregateError#browser_compatibility
  [Feature.AggregateError]: {
    es: [2021, 0, 0],
    chrome: [85, 0, 0],
    edge: [85, 0, 0],
    firefox: [79, 0, 0],
    opera: [71, 0, 0],
    safari: [14, 0, 0],
    ios: [14, 0, 0],
    samsung: [14, 0, 0],
    deno: [1, 2, 0],
    node: [15, 0, 0],
  },
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/values#browser_compatibility
  [Feature.ArrayPrototypeValues]: {
    es: [6, 0, 0],
    chrome: [66, 0, 0],
    edge: [14, 0, 0],
    firefox: [60, 0, 0],
    opera: [53, 0, 0],
    safari: [9, 0, 0],
    ios: [9, 0, 0],
    samsung: [9, 0, 0],
    deno: [1, 0, 0],
    node: [10, 9, 0],
  },
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions#browser_compatibility
  [Feature.ArrowFunction]: {
    es: [6, 0, 0],
    chrome: [45, 0, 0],
    edge: [12, 0, 0],
    firefox: [24, 0, 0],
    opera: [32, 0, 0],
    safari: [10, 0, 0],
    ios: [10, 0, 0],
    samsung: [5, 0, 0],
    deno: [1, 0, 0],
    node: [4, 0, 0],
  },
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt#browser_compatibility
  [Feature.BigInt]: {
    es: [2020, 0, 0],
    chrome: [67, 0, 0],
    edge: [79, 0, 0],
    firefox: [68, 0, 0],
    opera: [54, 0, 0],
    safari: [14, 0, 0],
    ios: [14, 0, 0],
    samsung: [9, 0, 0],
    deno: [1, 0, 0],
    node: [10, 4, 0],
  },
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map#browser_compatibility
  [Feature.Map]: {
    es: [6, 0, 0],
    chrome: [38, 0, 0],
    edge: [12, 0, 0],
    firefox: [13, 0, 0],
    opera: [25, 0, 0],
    safari: [8, 0, 0],
    ios: [8, 0, 0],
    samsung: [3, 0, 0],
    deno: [1, 0, 0],
    node: [0, 12, 0],
  },
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Method_definitions#browser_compatibility
  [Feature.MethodShorthand]: {
    es: [6, 0, 0],
    chrome: [39, 0, 0],
    edge: [12, 0, 0],
    firefox: [34, 0, 0],
    opera: [26, 0, 0],
    safari: [9, 0, 0],
    ios: [9, 0, 0],
    samsung: [4, 0, 0],
    deno: [1, 0, 0],
    node: [4, 0, 0],
  },
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign#browser_compatibility
  [Feature.ObjectAssign]: {
    es: [6, 0, 0],
    chrome: [45, 0, 0],
    edge: [12, 0, 0],
    firefox: [34, 0, 0],
    opera: [32, 0, 0],
    safari: [9, 0, 0],
    ios: [9, 0, 0],
    samsung: [5, 0, 0],
    deno: [1, 0, 0],
    node: [4, 0, 0],
  },
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise#browser_compatibility
  [Feature.Promise]: {
    es: [6, 0, 0],
    chrome: [32, 0, 0],
    edge: [12, 0, 0],
    firefox: [29, 0, 0],
    opera: [19, 0, 0],
    safari: [8, 0, 0],
    ios: [8, 0, 0],
    samsung: [2, 0, 0],
    deno: [1, 0, 0],
    node: [0, 12, 0],
  },
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set#browser_compatibility
  [Feature.Set]: {
    es: [6, 0, 0],
    chrome: [38, 0, 0],
    edge: [12, 0, 0],
    firefox: [13, 0, 0],
    opera: [25, 0, 0],
    safari: [8, 0, 0],
    ios: [8, 0, 0],
    samsung: [3, 0, 0],
    deno: [1, 0, 0],
    node: [0, 12, 0],
  },
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/iterator#browser_compatibility
  [Feature.SymbolIterator]: {
    es: [6, 0, 0],
    chrome: [43, 0, 0],
    edge: [12, 0, 0],
    firefox: [36, 0, 0],
    opera: [30, 0, 0],
    safari: [10, 0, 0],
    ios: [10, 0, 0],
    samsung: [4, 0, 0],
    deno: [1, 0, 0],
    node: [0, 12, 0],
  },
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray#browser_compatibility
  [Feature.TypedArray]: {
    es: [6, 0, 0],
    chrome: [7, 0, 0],
    edge: [12, 0, 0],
    firefox: [4, 0, 0],
    opera: [11, 6, 0],
    safari: [5, 1, 0],
    ios: [4, 2, 0],
    samsung: [1, 0, 0],
    deno: [1, 0, 0],
    node: [0, 10, 0],
  },
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt64Array#browser_compatibility
  [Feature.BigIntTypedArray]: {
    es: [2020, 0, 0],
    chrome: [67, 0, 0],
    edge: [79, 0, 0],
    firefox: [68, 0, 0],
    opera: [54, 6, 0],
    safari: [15, 1, 0],
    ios: [15, 2, 0],
    samsung: [9, 0, 0],
    deno: [1, 0, 0],
    node: [10, 4, 0],
  },
};

const TARGET_REGEX = /^(es|chrome|edge|safari|firefox|opera|ios|samsung|deno|node)([0-9]+(\.[0-9]+(\.[0-9]+)?)?)$/i;

export type Target = [platform: Platform, version: Version];

function parseTarget(target: string): Target {
  const result = TARGET_REGEX.exec(target);
  assert(result, `Invalid target "${target}"`);
  const [, platform, version] = result;
  const [major, minor = '0', patch = '0'] = version.split('.');
  return [platform as Platform, [Number(major), Number(minor), Number(patch)]];
}

function getTargetVersions(targets: string | string[]): Target[] {
  if (Array.isArray(targets)) {
    const versions: Target[] = [];
    for (const target of targets) {
      versions.push(parseTarget(target));
    }
    return versions;
  }
  return [parseTarget(targets)];
}

export function parseTargets(targets: string | string[]): number {
  const parsed = getTargetVersions(targets);
  let flags = 0;

  for (const key in VERSION_TABLE) {
    const base = VERSION_TABLE[key as unknown as Feature];
    let flag = true;
    for (const [platform, version] of parsed) {
      const baseVersion = base[platform];
      flag = flag && !!baseVersion && (compareVersion(baseVersion, version) <= 0);
    }
    if (flag) {
      flags |= Number(key);
    }
  }

  return flags;
}
