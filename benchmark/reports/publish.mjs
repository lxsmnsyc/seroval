import assert from 'node:assert/strict';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { comment, writeDashboard } from './report.mjs';
import { appendHistory, validateHistory, validateReport } from './results.mjs';

const branch = 'benchmark-results';
const repositoryPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const trailingSlash = /\/$/;
const files = [
  'history.json',
  'index.html',
  'size/index.html',
  'speed/index.html',
];

export function verifyRun(run, repository, defaultBranch, reports, pull) {
  assert.equal(run.repository.full_name, repository, 'Wrong run repository');
  assert.equal(run.path, '.github/workflows/benchmarks.yml', 'Wrong workflow');
  assert.equal(run.conclusion, 'success', 'Measurement run did not succeed');
  assert.equal(reports.length, 2);
  assert.deepStrictEqual(reports.map(report => report.kind).sort(), [
    'size',
    'speed',
  ]);
  for (const report of reports) {
    validateReport(report);
    assert.equal(
      report.candidate.revision,
      run.head_sha,
      'Candidate does not match run',
    );
  }
  if (run.event === 'pull_request') {
    assert.ok(pull, 'No current pull request matches this run');
    assert.equal(pull.state, 'open');
    assert.equal(pull.base.repo.full_name, repository);
    assert.equal(
      pull.head.repo.full_name,
      run.head_repository.full_name,
      'Wrong pull request head repository',
    );
    assert.equal(pull.head.ref, run.head_branch, 'Wrong pull request branch');
    assert.equal(pull.head.sha, run.head_sha, 'Stale pull request head');
    for (const report of reports) {
      assert.equal(
        report.baseline?.revision,
        pull.base.sha,
        'Stale pull request base',
      );
    }
    return 'comment';
  }
  assert.equal(run.event, 'push', 'Only push runs can enter history');
  assert.equal(run.head_branch, defaultBranch, 'Not the default branch');
  assert.equal(
    run.head_repository.full_name,
    repository,
    'Untrusted history source',
  );
  return 'history';
}

export async function upsertComment(api, prefix, number, kind, body) {
  const marker = `<!-- seroval-benchmark-${kind} -->`;
  let existing;
  for (let page = 1; ; page++) {
    const comments = await api(
      `${prefix}/issues/${number}/comments?per_page=100&page=${page}`,
    );
    existing = comments.find(
      item =>
        item.user.login === 'github-actions[bot]' &&
        item.body.startsWith(marker),
    );
    if (existing || comments.length < 100) {
      break;
    }
    assert.ok(page < 100, 'Comment pagination limit reached');
  }
  return existing
    ? api(`${prefix}/issues/comments/${existing.id}`, {
        method: 'PATCH',
        body: { body },
      })
    : api(`${prefix}/issues/${number}/comments`, {
        method: 'POST',
        body: { body },
      });
}

function loadReport(path) {
  assert.ok(
    statSync(path).size <= 2 * 1024 * 1024,
    'Report exceeds size limit',
  );
  return validateReport(JSON.parse(readFileSync(path, 'utf8')));
}

async function github(path, { method = 'GET', body, allow404 = false } = {}) {
  const response = await fetch(`https://api.github.com/${path}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${process.env.GH_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: body && JSON.stringify(body),
  });
  if (allow404 && response.status === 404) {
    return null;
  }
  assert.ok(response.ok, `GitHub ${method} ${path}: HTTP ${response.status}`);
  return response.status === 204 ? null : response.json();
}

async function readHistory(prefix) {
  const ref = await github(`${prefix}/git/ref/heads/${branch}`, {
    allow404: true,
  });
  if (!ref) {
    return { head: null, history: { schemaVersion: 1, reports: [] } };
  }
  const commit = await github(`${prefix}/git/commits/${ref.object.sha}`);
  const tree = await github(
    `${prefix}/git/trees/${commit.tree.sha}?recursive=1`,
  );
  assert.equal(tree.truncated, false, 'History tree is truncated');
  const entry = tree.tree.find(item => item.path === 'history.json');
  assert.ok(
    entry && entry.type === 'blob',
    'History branch has no history.json',
  );
  assert.ok(entry.size <= 16 * 1024 * 1024, 'History is too large');
  const blob = await github(`${prefix}/git/blobs/${entry.sha}`);
  assert.equal(blob.encoding, 'base64');
  const history = validateHistory(
    JSON.parse(Buffer.from(blob.content, 'base64').toString('utf8')),
  );
  return { head: ref.object.sha, history };
}

async function saveHistory(prefix, head, output, revision) {
  const tree = await github(`${prefix}/git/trees`, {
    method: 'POST',
    body: {
      tree: files.map(path => ({
        path,
        mode: '100644',
        type: 'blob',
        content: readFileSync(resolve(output, path), 'utf8'),
      })),
    },
  });
  const commit = await github(`${prefix}/git/commits`, {
    method: 'POST',
    body: {
      message: `Record benchmarks for ${revision}`,
      tree: tree.sha,
      parents: head ? [head] : [],
    },
  });
  if (head) {
    await github(`${prefix}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      body: { sha: commit.sha, force: false },
    });
  } else {
    await github(`${prefix}/git/refs`, {
      method: 'POST',
      body: { ref: `refs/heads/${branch}`, sha: commit.sha },
    });
  }
}

export async function publish(input, output) {
  assert.ok(process.env.GH_TOKEN, 'GH_TOKEN is required');
  const repository = process.env.GITHUB_REPOSITORY;
  assert.match(repository, repositoryPattern);
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const prefix = `repos/${repository}`;
  const run = await github(`${prefix}/actions/runs/${event.workflow_run.id}`);
  if (run.event === 'workflow_dispatch') {
    console.log(
      'Manual run: results remain in measurement artifacts; no publication.',
    );
    return;
  }
  const reports = ['size', 'speed'].map(kind =>
    loadReport(resolve(input, `${kind}.json`)),
  );
  const repo = await github(prefix);
  let pull;
  if (run.event === 'pull_request') {
    assert.match(run.head_repository.full_name, repositoryPattern);
    assert.ok(run.head_branch, 'Missing run head branch');
    const owner = run.head_repository.full_name.split('/')[0];
    const head = encodeURIComponent(`${owner}:${run.head_branch}`);
    // Fork runs may have neither commit-associated PRs nor pull_requests.
    for (let page = 1; ; page++) {
      const pulls = await github(
        `${prefix}/pulls?head=${head}&state=open&per_page=100&page=${page}`,
      );
      pull = pulls.find(
        item =>
          item.state === 'open' &&
          item.head.sha === run.head_sha &&
          item.head.ref === run.head_branch &&
          item.head.repo?.full_name === run.head_repository.full_name &&
          item.base.repo.full_name === repository &&
          reports.every(report => report.baseline?.revision === item.base.sha),
      );
      if (pull) {
        pull = await github(`${prefix}/pulls/${pull.number}`);
        break;
      }
      if (pulls.length < 100) {
        break;
      }
      assert.ok(page < 100, 'Pull request pagination limit reached');
    }
  }
  const mode = verifyRun(run, repository, repo.default_branch, reports, pull);
  const { head, history } = await readHistory(prefix);
  const pages = await github(`${prefix}/pages`, { allow404: true });
  const links = {
    run: `https://github.com/${repository}/actions/runs/${run.id}`,
    dashboard: pages?.html_url?.replace(trailingSlash, ''),
  };
  if (mode === 'comment') {
    for (const report of reports) {
      await upsertComment(
        github,
        prefix,
        pull.number,
        report.kind,
        comment(report, history, links),
      );
    }
  } else {
    // Run identity, not artifact text, owns history order.
    const ordered = reports.map(report => ({
      ...report,
      measuredAt: new Date(run.run_started_at).toISOString(),
    }));
    const updated = appendHistory(history, ordered);
    writeDashboard(updated, output);
    await saveHistory(prefix, head, output, run.head_sha);
    const enabled = pages?.build_type === 'workflow';
    if (!enabled) {
      console.log(
        '::warning::History saved on benchmark-results. Enable GitHub Pages with source GitHub Actions, then rerun this publisher to deploy the dashboards.',
      );
    }
    if (process.env.GITHUB_OUTPUT) {
      writeFileSync(process.env.GITHUB_OUTPUT, `deploy=${enabled}\n`, {
        flag: 'a',
      });
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await publish(resolve(process.argv[2]), resolve(process.argv[3]));
}
