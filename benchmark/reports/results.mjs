import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

/**
 * @typedef {object} Settings
 * @property {number} version
 * @property {string} target
 * @property {string} format
 * @property {string} bundlerPlatform
 * @property {number} gzipLevel
 * @property {number} brotliQuality
 * @property {number} rounds
 * @property {number} warmups
 * @property {number} [warmupMs] Missing before protocol version 2.
 * @property {number} [minSampleMs] Missing before protocol version 2.
 * @property {number} samples
 * @property {string[]} scenarios
 * @property {string} harness
 * @property {string} esbuild
 * @property {string} node
 * @property {string} v8
 * @property {string} zlib
 * @property {string} platform
 * @property {string} arch
 * @property {string} cpu
 */

/**
 * Size rows have `raw`, `gzip` and `brotli`. Speed rows have `samples`, and
 * warm speed rows also have `iterations`.
 * @typedef {object} Row
 * @property {string} id
 * @property {string} unit
 * @property {number} [raw]
 * @property {number} [gzip]
 * @property {number} [brotli]
 * @property {number} [iterations]
 * @property {number[]} [samples]
 */

/**
 * @typedef {object} Side
 * @property {string} revision
 * @property {string} lockHash
 * @property {Row[]} rows
 */

/**
 * @typedef {object} Report
 * @property {number} schemaVersion
 * @property {string} kind
 * @property {string} measuredAt
 * @property {Settings} settings
 * @property {Side} candidate
 * @property {Side | null} baseline
 */

/**
 * @typedef {object} History
 * @property {number} schemaVersion
 * @property {Report[]} reports
 */

/**
 * @typedef {object} Stats
 * @property {number} median
 * @property {number} min
 * @property {number} max
 */

/**
 * @typedef {object} Change
 * @property {number} absolute
 * @property {number | null} percent
 */

const sha = /^[a-f0-9]{40}$/;
const digest = /^[a-f0-9]{64}$/;
const safeId = /^[a-zA-Z0-9.-]{1,100}$/;
export const speedIds = [
  'object.small',
  'object.collection',
  'object.references',
  'string.short',
  'string.plain-64k',
  'string.html-64k',
  'binary.64',
  'binary.64k',
].flatMap((id) =>
  ['serialize', 'toJSON', 'fromJSON', 'deserialize-warm'].map((name) => `${id}.${name}`),
);
speedIds.push(
  'async.promise.toJSONAsync',
  'async.iterable.toJSONAsync',
  'stream.first-output',
  'stream.completion',
  'object.collection.deserialize-cold',
);

/**
 * @param {number | undefined} value
 * @param {boolean} [integer]
 * @returns {void}
 */
function number(value, integer = false) {
  assert.ok(Number.isFinite(value) && value >= 0 && value <= 1e10, 'Invalid measurement');
  if (integer) {
    assert.ok(Number.isSafeInteger(value), 'Expected integer bytes');
  }
}

/**
 * @param {Report} report
 * @param {Row} row
 * @returns {void}
 */
function validateSpeedRow(report, row) {
  assert.equal(row.unit, 'ms');
  if (report.settings.version >= 2 && !row.id.endsWith('-cold') && !row.id.startsWith('stream.')) {
    assert.ok(
      Number.isSafeInteger(row.iterations) && row.iterations > 0 && row.iterations <= 2 ** 24,
      'Invalid batch iterations',
    );
    if (report.baseline) {
      assert.equal(
        row.iterations,
        report.baseline.rows.find((item) => item.id === row.id)?.iterations,
        'Paired batch iterations differ',
      );
    }
  }
  assert.ok(Array.isArray(row.samples));
  const expected = row.id.endsWith('-cold')
    ? report.settings.samples
    : report.settings.rounds * report.settings.samples;
  assert.equal(row.samples.length, expected, 'Incomplete timing samples');
  for (const sample of row.samples) {
    number(sample);
    assert.ok(sample > 0, 'Timer did not resolve the operation');
  }
}

/**
 * @param {unknown} value
 * @returns {Report}
 */
export function validateReport(value) {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The assertions below check this shape.
  const report = /** @type {Report} */ (value);
  assert.equal(report.schemaVersion, 1, 'Unsupported report schema');
  assert.ok(['size', 'speed'].includes(report.kind), 'Invalid report kind');
  assert.equal(new Date(report.measuredAt).toISOString(), report.measuredAt, 'Invalid timestamp');
  assert.ok(digest.test(report.settings.harness), 'Invalid harness digest');
  for (const key of /** @type {const} */ (['version', 'rounds', 'samples'])) {
    assert.ok(
      Number.isSafeInteger(report.settings[key]) &&
        report.settings[key] >= 1 &&
        report.settings[key] <= 100,
      `Invalid protocol setting: ${key}`,
    );
  }
  for (const key of /** @type {const} */ (['warmups', 'gzipLevel', 'brotliQuality'])) {
    assert.ok(
      Number.isSafeInteger(report.settings[key]) &&
        report.settings[key] >= 0 &&
        report.settings[key] <= 100,
      `Invalid protocol setting: ${key}`,
    );
  }
  if (report.kind === 'speed' && report.settings.version >= 2) {
    for (const key of /** @type {const} */ (['warmupMs', 'minSampleMs'])) {
      assert.ok(
        Number.isFinite(report.settings[key]) &&
          report.settings[key] > 0 &&
          report.settings[key] <= 10000,
        `Invalid timing budget: ${key}`,
      );
    }
  }
  for (const key of /** @type {const} */ ([
    'esbuild',
    'node',
    'v8',
    'zlib',
    'platform',
    'arch',
    'cpu',
    'target',
    'format',
    'bundlerPlatform',
  ])) {
    assert.equal(typeof report.settings[key], 'string', `Missing environment: ${key}`);
    assert.ok(report.settings[key].length > 0 && report.settings[key].length <= 200);
  }
  const expectedIds = report.settings.scenarios;
  assert.ok(
    Array.isArray(expectedIds) && expectedIds.length > 0 && expectedIds.length <= 128,
    'Invalid scenario manifest',
  );
  assert.equal(new Set(expectedIds).size, expectedIds.length, 'Duplicate scenario manifest');
  assert.ok(
    expectedIds.every((id) => typeof id === 'string' && safeId.test(id)),
    'Invalid scenario ID',
  );
  assert.ok(report.candidate, 'Missing candidate');
  assert.ok(report.baseline === null || typeof report.baseline === 'object', 'Invalid baseline');
  for (const side of [report.candidate, report.baseline].filter(Boolean)) {
    assert.ok(sha.test(side.revision), 'Invalid source revision');
    assert.ok(digest.test(side.lockHash), 'Invalid lockfile digest');
    assert.ok(Array.isArray(side.rows), 'Missing scenarios');
    assert.deepStrictEqual(
      side.rows.map((row) => row.id).sort(),
      [...expectedIds].sort(),
      'Missing, duplicate, or unknown scenario',
    );
    for (const row of side.rows) {
      assert.ok(safeId.test(row.id));
      if (report.kind === 'size') {
        assert.equal(row.unit, 'bytes');
        for (const metric of /** @type {const} */ (['raw', 'gzip', 'brotli'])) {
          number(row[metric], true);
          assert.ok(row[metric] > 0, 'Empty bundle');
        }
      } else {
        validateSpeedRow(report, row);
      }
    }
  }
  return report;
}

/**
 * @param {number[]} samples
 * @returns {Stats}
 */
export function statistics(samples) {
  assert.ok(samples.length > 0, 'No samples');
  const sorted = [...samples].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return {
    median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
    min: sorted[0],
    max: sorted.at(-1),
  };
}

/**
 * @param {Row} row
 * @param {Settings} settings
 * @returns {Stats}
 */
export function timingStatistics(row, settings) {
  const stats = statistics(row.samples);
  if (settings.version < 2 || row.id.endsWith('-cold')) {
    return stats;
  }
  const medians = [];
  for (let start = 0; start < row.samples.length; start += settings.samples) {
    medians.push(statistics(row.samples.slice(start, start + settings.samples)).median);
  }
  return { ...stats, median: statistics(medians).median };
}

/**
 * @param {Row} current
 * @param {Row} baseline
 * @param {Settings} settings
 * @returns {Stats | null}
 */
export function pairedChanges(current, baseline, settings) {
  if (settings.version < 2) {
    return null;
  }
  const count = current.id.endsWith('-cold') ? 1 : settings.samples;
  const changes = [];
  for (let start = 0; start < current.samples.length; start += count) {
    changes.push(
      difference(
        statistics(current.samples.slice(start, start + count)).median,
        statistics(baseline.samples.slice(start, start + count)).median,
      ).percent,
    );
  }
  return statistics(changes);
}

/**
 * @param {number} current
 * @param {number} baseline
 * @returns {Change}
 */
export function difference(current, baseline) {
  return {
    absolute: current - baseline,
    percent: baseline === 0 ? null : ((current - baseline) / baseline) * 100,
  };
}

/**
 * @param {Report} report
 * @returns {string}
 */
export function seriesId(report) {
  const entries = Object.entries(report.settings).sort(([a], [b]) => a.localeCompare(b));
  return createHash('sha256').update(JSON.stringify(entries)).digest('hex');
}

/**
 * @param {unknown} value
 * @returns {History}
 */
export function validateHistory(value) {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The assertions below check this shape.
  const history = /** @type {History} */ (value);
  assert.equal(history.schemaVersion, 1, 'Unsupported history schema');
  assert.ok(Array.isArray(history.reports) && history.reports.length <= 200, 'Invalid history');
  for (const report of history.reports) {
    validateReport(report);
    assert.equal(report.baseline, null, 'History stores candidates only');
  }
  return history;
}

/**
 * @param {History} history
 * @param {Report[]} incoming
 * @returns {History}
 */
export function appendHistory(history, incoming) {
  validateHistory(history);
  const result = [...history.reports];
  for (const report of incoming) {
    validateReport(report);
    const index = result.findIndex(
      (item) =>
        item.kind === report.kind &&
        item.candidate.revision === report.candidate.revision &&
        seriesId(item) === seriesId(report),
    );
    const record = { ...report, baseline: null };
    if (index < 0) {
      result.push(record);
    } else if (result[index].measuredAt <= record.measuredAt) {
      result[index] = record;
    }
  }
  result.sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  return { schemaVersion: 1, reports: result.slice(-200) };
}

/**
 * @param {History} history
 * @param {Report} report
 * @param {string} id
 * @returns {number[]}
 */
export function trend(history, report, id) {
  return history.reports
    .filter((item) => item.kind === report.kind && seriesId(item) === seriesId(report))
    .slice(-20)
    .map((item) => {
      const row = item.candidate.rows.find((value) => value.id === id);
      assert.ok(row, 'History scenario missing');
      return report.kind === 'size' ? row.gzip : timingStatistics(row, report.settings).median;
    });
}
