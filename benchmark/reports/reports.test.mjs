import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { protocol, sizeFixtures } from './config.mjs';
import { publish, upsertComment, verifyRun } from './publish.mjs';
import { comment, dashboard, writeDashboard } from './report.mjs';
import {
  appendHistory,
  difference,
  seriesId,
  statistics,
  trend,
  validateHistory,
  validateReport,
} from './results.mjs';
import { measureAsync, measureSync, values, verifyValue } from './runtime.mjs';

function report(kind = 'size') {
  const rows =
    kind === 'size'
      ? sizeFixtures.map(({ id }) => ({
          id,
          unit: 'bytes',
          raw: 300,
          gzip: 100,
          brotli: 90,
        }))
      : [
          ...values().flatMap(([id]) =>
            ['serialize', 'toJSON', 'fromJSON', 'deserialize-warm'].map(
              name => `${id}.${name}`,
            ),
          ),
          'async.promise.toJSONAsync',
          'async.iterable.toJSONAsync',
          'stream.first-output',
          'stream.completion',
          'object.collection.deserialize-cold',
        ].map(id => ({
          id,
          unit: 'ms',
          samples: new Array(
            id.endsWith('-cold')
              ? protocol.samples
              : protocol.samples * protocol.rounds,
          ).fill(0.25),
        }));
  return {
    schemaVersion: 1,
    kind,
    measuredAt: '2026-09-28T03:00:00.000Z',
    settings: {
      ...protocol,
      scenarios: rows.map(row => row.id),
      harness: 'a'.repeat(64),
      esbuild: '0.28.2',
      node: 'v22.0.0',
      v8: '12',
      zlib: '1',
      platform: 'linux',
      arch: 'x64',
      cpu: 'test CPU',
    },
    candidate: { revision: 'a'.repeat(40), lockHash: 'b'.repeat(64), rows },
    baseline: {
      revision: 'b'.repeat(40),
      lockHash: 'b'.repeat(64),
      rows: structuredClone(rows),
    },
  };
}

const empty = () => ({ schemaVersion: 1, reports: [] });
const invalidMeasurement = /Invalid measurement/;
const incompleteTiming = /Incomplete timing/;
const emptyBundle = /Empty bundle/;
const candidateHistory = /candidates only/;
const staleBase = /Stale pull request base/;
const untrustedHistory = /Untrusted history/;
const onlyPush = /Only push/;

test('schema accepts full size/speed reports and rejects missing, duplicate, malformed and incomplete results', () => {
  for (const kind of ['size', 'speed']) {
    assert.equal(validateReport(report(kind)).kind, kind);
    for (const change of [
      value => {
        value.candidate.rows.pop();
      },
      value => {
        value.candidate.rows[1] = value.candidate.rows[0];
      },
      value => {
        value.candidate.revision = '../untrusted';
      },
      value => {
        value.settings.rounds = 0;
      },
      value => {
        value.candidate.rows[0].unit = 'seconds';
      },
      value => {
        value.measuredAt = '<script>';
      },
    ]) {
      const invalid = report(kind);
      change(invalid);
      assert.throws(() => validateReport(invalid));
    }
  }
  const invalid = report('speed');
  invalid.candidate.rows[0].samples[0] = Number.NaN;
  assert.throws(() => validateReport(invalid), invalidMeasurement);
  invalid.candidate.rows[0].samples = [];
  assert.throws(() => validateReport(invalid), incompleteTiming);
  const size = report();
  size.candidate.rows[0].gzip = 0;
  assert.throws(() => validateReport(size), emptyBundle);
});

test('statistics and deltas retain units, direction and zero-baseline absence', () => {
  assert.deepEqual(statistics([4, 1, 3, 2]), { min: 1, median: 2.5, max: 4 });
  assert.deepEqual(statistics([9, 1, 2]), { min: 1, median: 2, max: 9 });
  assert.deepEqual(difference(120, 100), { absolute: 20, percent: 20 });
  assert.deepEqual(difference(80, 100), { absolute: -20, percent: -20 });
  assert.deepEqual(difference(10, 0), { absolute: 10, percent: null });
});

test('report shows an injected size increase, speed change, sample spread and missing baseline', () => {
  const size = report();
  size.candidate.rows[0].gzip += 20;
  assert.ok(comment(size).includes('+20 (+20.00%)'));
  const speed = report('speed');
  speed.candidate.rows[0].samples.fill(0.5);
  assert.ok(comment(speed).includes('+0.250000 (+100.00%)'));
  assert.ok(comment(speed).includes('ranges separate'));
  assert.ok(comment(report('speed')).includes('ranges overlap'));
  size.baseline = null;
  assert.ok(comment(size).includes('baseline unavailable'));
});

test('history creates, updates idempotently, orders and separates incompatible series', () => {
  const first = report();
  let history = appendHistory(empty(), [first, report('speed')]);
  assert.equal(history.reports.length, 2);
  history = appendHistory(history, [first]);
  assert.equal(history.reports.length, 2);
  const next = structuredClone(first);
  next.candidate.revision = 'c'.repeat(40);
  next.measuredAt = '2026-09-29T03:00:00.000Z';
  next.candidate.rows[0].gzip = 120;
  history = appendHistory(history, [next]);
  assert.deepEqual(trend(history, next, next.candidate.rows[0].id), [100, 120]);
  next.settings.node = 'v24.0.0';
  assert.notEqual(seriesId(first), seriesId(next));
  history = appendHistory(history, [next]);
  assert.deepEqual(trend(history, next, next.candidate.rows[0].id), [120]);
  const invalid = structuredClone(history);
  invalid.reports[0].baseline = first.baseline;
  assert.throws(() => validateHistory(invalid), candidateHistory);
});

test('dashboard escapes artifact text and provides readable tables without JavaScript', () => {
  const value = report();
  value.settings.cpu = '<script>alert("x")</script>';
  const history = appendHistory(empty(), [value, report('speed')]);
  const html = dashboard(history, 'size');
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('<caption>'));
  assert.ok(html.includes('scope="col"'));
  const directory = mkdtempSync(join(tmpdir(), 'seroval-dashboard-'));
  try {
    writeDashboard(history, directory);
    for (const path of [
      'index.html',
      'size/index.html',
      'speed/index.html',
      'history.json',
    ]) {
      assert.ok(readFileSync(join(directory, path)).length > 0);
    }
    writeDashboard(history, directory);
    assert.deepEqual(
      JSON.parse(readFileSync(join(directory, 'history.json'), 'utf8')),
      history,
    );
  } finally {
    rmSync(directory, { recursive: true });
  }
});

function run(event = 'pull_request') {
  return {
    repository: { full_name: 'owner/seroval' },
    head_repository: { full_name: 'owner/seroval' },
    path: '.github/workflows/benchmarks.yml',
    conclusion: 'success',
    head_sha: 'a'.repeat(40),
    head_branch: 'main',
    event,
  };
}

function pull() {
  return {
    state: 'open',
    number: 1,
    base: { sha: 'b'.repeat(40), repo: { full_name: 'owner/seroval' } },
    head: { sha: 'a'.repeat(40), repo: { full_name: 'contributor/seroval' } },
  };
}

test('publisher accepts current fork PRs but rejects wrong, stale and untrusted identities', () => {
  const reports = [report(), report('speed')];
  assert.equal(
    verifyRun(run(), 'owner/seroval', 'main', reports, pull()),
    'comment',
  );
  assert.equal(
    verifyRun(run('push'), 'owner/seroval', 'main', reports),
    'history',
  );
  for (const change of [
    value => {
      value.path = '.github/workflows/other.yml';
    },
    value => {
      value.head_sha = 'c'.repeat(40);
    },
    value => {
      value.conclusion = 'failure';
    },
    value => {
      value.repository.full_name = 'other/repo';
    },
  ]) {
    const invalid = run();
    change(invalid);
    assert.throws(() =>
      verifyRun(invalid, 'owner/seroval', 'main', reports, pull()),
    );
  }
  const stale = pull();
  stale.base.sha = 'c'.repeat(40);
  assert.throws(
    () => verifyRun(run(), 'owner/seroval', 'main', reports, stale),
    staleBase,
  );
  const untrusted = run('push');
  untrusted.head_repository.full_name = 'fork/seroval';
  assert.throws(
    () => verifyRun(untrusted, 'owner/seroval', 'main', reports),
    untrustedHistory,
  );
  assert.throws(
    () => verifyRun(run('workflow_dispatch'), 'owner/seroval', 'main', reports),
    onlyPush,
  );
});

test('comment publication creates then updates only the bot-owned marker, including pagination', async () => {
  const stored = [
    {
      id: 1,
      user: { login: 'person' },
      body: '<!-- seroval-benchmark-size -->',
    },
  ];
  const writes = [];
  const api = (path, options) => {
    if (!options) {
      return stored;
    }
    writes.push({ path, ...options });
    if (options.method === 'POST') {
      stored.push({
        id: 2,
        user: { login: 'github-actions[bot]' },
        body: options.body.body,
      });
    }
    return {};
  };
  const body = '<!-- seroval-benchmark-size -->\nreport';
  await upsertComment(api, 'repos/owner/seroval', 1, 'size', body);
  await upsertComment(api, 'repos/owner/seroval', 1, 'size', body);
  assert.deepEqual(
    writes.map(item => item.method),
    ['POST', 'PATCH'],
  );
  assert.ok(writes[1].path.endsWith('/comments/2'));
  const pages = [];
  await upsertComment(
    (path, options) => {
      if (options) {
        assert.equal(options.method, 'PATCH');
        return {};
      }
      pages.push(path);
      return path.endsWith('page=1')
        ? new Array(100).fill(stored[0])
        : [stored[1]];
    },
    'repos/owner/seroval',
    1,
    'size',
    body,
  );
  assert.equal(pages.length, 2);
});

test('correctness rejects lost shared references and invalid timed output', () => {
  const graph = values().find(([id]) => id === 'object.references')[1];
  const bad = { left: { ...graph.left }, right: { ...graph.right } };
  bad.self = bad;
  assert.throws(() => verifyValue(bad, graph));
  assert.throws(() =>
    measureSync(
      () => 0,
      value => assert.equal(value, 1),
      2,
      { samples: 1, warmups: 0 },
    ),
  );
});

test('async timing awaits completion and validation runs after the operation', async () => {
  const order = [];
  const samples = await measureAsync(
    () => {
      order.push('prepare');
      return 1;
    },
    async value => {
      order.push('start');
      await new Promise(resolve => setTimeout(resolve, 20));
      order.push('complete');
      return value;
    },
    value => {
      assert.equal(value, 1);
      order.push('verify');
    },
    { samples: 1, warmups: 0 },
  );
  assert.deepEqual(order, ['prepare', 'start', 'complete', 'verify']);
  assert.ok(samples[0] >= 10);
});

test('publisher creates and incrementally maintains both dashboard artifacts and branch history', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'seroval-publisher-'));
  const input = join(directory, 'input');
  const output = join(directory, 'site');
  mkdirSync(input);
  for (const kind of ['size', 'speed']) {
    writeFileSync(join(input, `${kind}.json`), JSON.stringify(report(kind)));
  }
  const eventPath = join(directory, 'event.json');
  writeFileSync(eventPath, JSON.stringify({ workflow_run: { id: 11 } }));
  const environment = {
    GH_TOKEN: 'test-token-not-a-secret',
    GITHUB_REPOSITORY: 'owner/seroval',
    GITHUB_EVENT_PATH: eventPath,
    GITHUB_OUTPUT: join(directory, 'output'),
  };
  const before = {};
  for (const [key, value] of Object.entries(environment)) {
    before[key] = process.env[key];
    process.env[key] = value;
  }
  let head = null;
  let tree = [];
  let commits = 0;
  let pagesEnabled = false;
  const writes = [];
  const messages = [];
  t.mock.method(console, 'log', message => messages.push(message));
  t.mock.method(globalThis, 'fetch', (url, options) => {
    const path = String(url).slice(
      'https://api.github.com/repos/owner/seroval'.length,
    );
    const body = options.body && JSON.parse(options.body);
    const reply = (value, status = 200) =>
      Promise.resolve(new Response(JSON.stringify(value), { status }));
    if (options.method !== 'GET') {
      writes.push({ path, body });
    }
    if (path === '/actions/runs/11') {
      return reply({
        ...run('push'),
        id: 11,
        run_started_at: '2026-09-28T03:00:00Z',
      });
    }
    if (path === '') {
      return reply({ default_branch: 'main' });
    }
    if (path === '/pages') {
      return pagesEnabled
        ? reply({
            build_type: 'workflow',
            html_url: 'https://owner.github.io/seroval/',
          })
        : reply({}, 404);
    }
    if (path === '/git/ref/heads/benchmark-results') {
      return head ? reply({ object: { sha: head } }) : reply({}, 404);
    }
    if (path.startsWith('/git/commits/') && options.method === 'GET') {
      return reply({ tree: { sha: 'saved-tree' } });
    }
    if (path === '/git/trees/saved-tree?recursive=1') {
      return reply({
        truncated: false,
        tree: tree.map(item => ({
          path: item.path,
          type: 'blob',
          sha: 'history-blob',
          size: item.content.length,
        })),
      });
    }
    if (path === '/git/blobs/history-blob') {
      return reply({
        encoding: 'base64',
        content: Buffer.from(
          tree.find(item => item.path === 'history.json').content,
        ).toString('base64'),
      });
    }
    if (path === '/git/trees' && options.method === 'POST') {
      tree = body.tree;
      return reply({ sha: 'new-tree' });
    }
    if (path === '/git/commits' && options.method === 'POST') {
      assert.deepEqual(body.parents, head ? [head] : []);
      commits++;
      return reply({ sha: String(commits).repeat(40) });
    }
    if (path === '/git/refs' || path === '/git/refs/heads/benchmark-results') {
      if (head) {
        assert.equal(body.force, false);
      }
      head = body.sha;
      return reply({});
    }
    throw new Error(`Unexpected API call: ${options.method} ${path}`);
  });
  try {
    await publish(input, output);
    assert.deepEqual(tree.map(item => item.path).sort(), [
      'history.json',
      'index.html',
      'size/index.html',
      'speed/index.html',
    ]);
    assert.ok(messages.some(message => message.includes('::warning::')));
    pagesEnabled = true;
    await publish(input, output);
    const history = JSON.parse(
      readFileSync(join(output, 'history.json'), 'utf8'),
    );
    assert.equal(history.reports.length, 2);
    assert.equal(writes.filter(item => item.path === '/git/refs').length, 1);
    assert.equal(
      writes.filter(item => item.path === '/git/refs/heads/benchmark-results')
        .length,
      1,
    );
    assert.ok(
      readFileSync(join(output, 'size/index.html'), 'utf8').includes(
        'core.serialize',
      ),
    );
    assert.ok(
      readFileSync(join(output, 'speed/index.html'), 'utf8').includes(
        'stream.completion',
      ),
    );
    assert.ok(
      readFileSync(environment.GITHUB_OUTPUT, 'utf8').includes('deploy=false'),
    );
    assert.ok(
      readFileSync(environment.GITHUB_OUTPUT, 'utf8').includes('deploy=true'),
    );
  } finally {
    for (const key of Object.keys(environment)) {
      if (before[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = before[key];
      }
    }
    rmSync(directory, { recursive: true });
  }
});
