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

interface VersionTable {
  'aggregate-error': PlatformVersion;
  'array-values': PlatformVersion;
  'arrow-function': PlatformVersion;
  'bigint': PlatformVersion;
  'error-cause': PlatformVersion;
  'map': PlatformVersion;
  'method-shorthand': PlatformVersion;
  'object-assign': PlatformVersion;
  'promise': PlatformVersion;
  'set': PlatformVersion;
  'symbol-iterator': PlatformVersion;
  'typed-arrays': PlatformVersion;
}

export type Feature = keyof VersionTable;

const VERSION_TABLE: VersionTable = {
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AggregateError#browser_compatibility
  'aggregate-error': {
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
  'array-values': {
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
  'arrow-function': {
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
  bigint: {
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
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause#browser_compatibility
  'error-cause': {
    es: [2022, 0, 0],
    chrome: [93, 0, 0],
    edge: [93, 0, 0],
    firefox: [91, 0, 0],
    safari: [15, 0, 0],
    ios: [15, 0, 0],
    samsung: [17, 0, 0],
    deno: [1, 13, 0],
    node: [16, 9, 0],
  },
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map#browser_compatibility
  map: {
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
  'method-shorthand': {
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
  'object-assign': {
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
  promise: {
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
  set: {
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
  'symbol-iterator': {
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
  'typed-arrays': {
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

export function parseTargets(targets: string | string[]): Target[] {
  if (Array.isArray(targets)) {
    const versions: Target[] = [];
    for (const target of targets) {
      versions.push(parseTarget(target));
    }
    return versions;
  }
  return [parseTarget(targets)];
}

export function isFeatureSupported(key: Feature, targets: Target[]) {
  const base = VERSION_TABLE[key];
  let flag = true;
  for (const [platform, version] of targets) {
    const baseVersion = base[platform];
    flag = flag && !!baseVersion && (compareVersion(baseVersion, version) <= 0);
  }
  return flag;
}
