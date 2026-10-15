import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import {
  difference,
  pairedChanges,
  seriesId,
  timingStatistics,
  trend,
  validateHistory,
  validateReport,
} from './results.mjs';

export function escapeHTML(value) {
  return String(value).replace(
    /[&<>"']/g,
    char =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char],
  );
}

function signed(value, digits = 0) {
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;
}

function sizeDelta(value, baseline, percent = false) {
  if (baseline === undefined) {
    return 'baseline unavailable';
  }
  if (value === baseline) {
    return '—';
  }
  const change = difference(value, baseline);
  return `${signed(change.absolute)} B${percent ? ` (${signed(change.percent, 2)}%)` : ''}`;
}

function sparkline(values) {
  if (values.length < 2) {
    return 'collecting history';
  }
  const min = Math.min(...values);
  const range = Math.max(...values) - min;
  const bars = '▁▂▃▄▅▆▇█';
  return values
    .map(
      value => bars[range === 0 ? 0 : Math.round(((value - min) / range) * 7)],
    )
    .join('');
}

export function comment(
  report,
  history = { schemaVersion: 1, reports: [] },
  links = {},
) {
  validateReport(report);
  validateHistory(history);
  const size = report.kind === 'size';
  const compared = report.candidate.rows
    .map(row => {
      const before = report.baseline?.rows.find(item => item.id === row.id);
      const current = size ? row : timingStatistics(row, report.settings);
      const base =
        before && (size ? before : timingStatistics(before, report.settings));
      const pairs =
        !size && before && pairedChanges(row, before, report.settings);
      const change =
        base &&
        difference(
          size ? current.gzip : current.median,
          size ? base.gzip : base.median,
        );
      if (pairs) {
        change.percent = pairs.median;
      }
      return { row, current, base, change, pairs };
    })
    .filter(
      ({ current, base, change }) =>
        !base ||
        (size
          ? current.raw !== base.raw ||
            current.gzip !== base.gzip ||
            current.brotli !== base.brotli
          : Math.abs(change.percent) >= 5),
    )
    .sort((a, b) => {
      if (!(a.change && b.change)) {
        return 0;
      }
      return size
        ? b.change.absolute - a.change.absolute
        : a.change.percent - b.change.percent;
    });
  const inconclusive = compared.filter(
    ({ pairs }) => pairs && pairs.min < 5 && pairs.max > -5,
  );
  const rows = compared
    .filter(({ pairs }) => !pairs || pairs.min >= 5 || pairs.max <= -5)
    .map(entry => ({
      ...entry,
      historyValues: trend(history, report, entry.row.id),
    }));
  const hasTrend = rows.some(entry => entry.historyValues.length > 0);
  const hidden = report.candidate.rows.length - rows.length;
  const lines = [
    `<!-- seroval-benchmark-${report.kind} -->`,
    `## ${size ? 'Bundle Size Benchmarks' : 'Runtime Speed Benchmarks'}`,
    '',
    `${report.baseline ? `\`${report.baseline.revision.slice(0, 8)}\`` : 'baseline unavailable'} → \`${report.candidate.revision.slice(0, 8)}\``,
    '',
    report.baseline
      ? size
        ? `**${rows.length} changed · ${hidden} unchanged hidden.**`
        : report.settings.version >= 2
          ? `**${rows.length} repeatable changes shown · ${inconclusive.length} inconclusive · ${report.candidate.rows.length - compared.length} below the 5% display filter hidden.**`
          : `**${rows.length} shown · ${hidden} below the 5% display filter hidden.**`
      : `**${rows.length} shown · baseline unavailable; no rows filtered.**`,
    '',
  ];
  if (links.dashboard) {
    lines.push(`- [History dashboard](${links.dashboard}/${report.kind}/)`);
  }
  if (links.run) {
    lines.push(`- [Run and raw result artifacts](${links.run})`);
  }
  if (rows.length) {
    lines.push(
      '',
      size
        ? `| Scenario | Gzip size | Gzip change | Raw change | Brotli change |${hasTrend ? ' Gzip trend |' : ''}`
        : `| Scenario | Median µs/op | Time change |${hasTrend ? ' Median trend |' : ''}`,
      `${size ? '| --- | ---: | ---: | ---: | ---: |' : '| --- | ---: | ---: |'}${hasTrend ? ' --- |' : ''}`,
    );
    for (const { row, current, base, change, historyValues } of rows) {
      const chart = hasTrend
        ? ` ${sparkline([...historyValues, size ? current.gzip : current.median])} |`
        : '';
      lines.push(
        size
          ? `| \`${row.id}\` | ${current.gzip.toLocaleString('en-US')} B | ${sizeDelta(current.gzip, base?.gzip, true)} | ${sizeDelta(current.raw, base?.raw)} | ${sizeDelta(current.brotli, base?.brotli)} |${chart}`
          : `| \`${row.id}\` | ${(current.median * 1000).toFixed(3)} | ${change ? `${signed(change.percent, 2)}%` : 'baseline unavailable'} |${chart}`,
      );
    }
  }
  lines.push(
    '',
    size
      ? '— = unchanged. Rows are hidden only when raw, gzip, and Brotli sizes are all unchanged. Lower is smaller.'
      : report.settings.version >= 2
        ? 'Time change is the median of paired process changes. A change is shown only when every pair changes by at least 5% in the same direction. Other changes of at least 5% are inconclusive and remain in details. This is a repeatability filter, not a statistical test or performance gate. Lower time is better.'
        : 'Only median changes of at least 5% in either direction are shown when a baseline is available. This is a display filter, not a statistical test or performance gate. Lower time is better.',
    '',
    'Full results remain in the JSON report.',
    '',
    '<details>',
    '<summary>Measurement details</summary>',
    '',
    `- Candidate: \`${report.candidate.revision}\``,
    `- Baseline: ${report.baseline ? `\`${report.baseline.revision}\` (paired run)` : 'unavailable'}`,
    `- Measured: ${report.measuredAt}`,
    `- Series: \`${seriesId(report).slice(0, 12)}\``,
    '',
    size
      ? 'Production Seroval ESM import costs, not package tarball sizes. Compression settings are fixed.'
      : 'Ranges show sample min–max, not confidence intervals. Median changes and range overlap do not establish improvements or regressions. Warm decode reuses code; cold decode uses a fresh process and excludes startup/import/encoding. Streaming first-output includes the initial record; completion measures emission, not decoding.',
  );
  if (!size && compared.length) {
    if (report.settings.version >= 2) {
      lines.push(
        '',
        `Warm timings use the median of ${report.settings.rounds} independent process medians. Each process warms up for at least ${report.settings.warmupMs} ms of timed work. Sync and async throughput batches target ${report.settings.minSampleMs} ms, with the same calibrated iteration count on both sides. Cold and streaming latency remain per-operation measurements.`,
      );
    }
    lines.push(
      '',
      `| Scenario | Baseline range µs/op | Candidate range µs/op | Observation |${report.settings.version >= 2 ? ' Paired change range | Repeatability |' : ''}`,
      `| --- | ---: | ---: | --- |${report.settings.version >= 2 ? ' ---: | --- |' : ''}`,
    );
    for (const { row, current, base, pairs } of compared) {
      const overlap =
        base && current.min <= base.max && base.min <= current.max;
      lines.push(
        `| \`${row.id}\` | ${base ? `${(base.min * 1000).toFixed(3)}–${(base.max * 1000).toFixed(3)}` : 'unavailable'} | ${(current.min * 1000).toFixed(3)}–${(current.max * 1000).toFixed(3)} | ${base ? (overlap ? 'ranges overlap' : 'ranges separate') : 'no baseline'} |${report.settings.version >= 2 ? (pairs ? ` ${signed(pairs.min, 2)}% to ${signed(pairs.max, 2)}% | ${pairs.min >= 5 || pairs.max <= -5 ? 'same direction in every pair' : 'inconclusive'} |` : ' unavailable | no baseline |') : ''}`,
      );
    }
  }
  if (hasTrend) {
    lines.push(
      '',
      'Trends contain matching default-branch history plus this candidate. Changed harnesses or environments start separate series.',
    );
  }
  lines.push('', '</details>');
  return `${lines.join('\n')}\n`;
}

function page(title, body) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${escapeHTML(title)}</title>
<style>body{font:16px system-ui;margin:2rem;line-height:1.5;color:#18212a;background:#fff}a{color:#005ea8}table{border-collapse:collapse;white-space:nowrap}th,td{padding:.4rem .7rem;border:1px solid #aab;text-align:left}caption{text-align:left;font-weight:bold}section{margin:2rem 0}.scroll{overflow:auto}code{overflow-wrap:anywhere}summary{cursor:pointer}:focus-visible{outline:3px solid #005ea8;outline-offset:3px}</style></head>
<body><main><h1>${escapeHTML(title)}</h1>${body}</main></body></html>\n`;
}

export function dashboard(history, kind) {
  validateHistory(history);
  const records = history.reports.filter(report => report.kind === kind);
  const latest = records.at(-1);
  if (!latest) {
    return page(`${kind} benchmarks`, '<p>No measurements yet.</p>');
  }
  const matching = records.filter(
    report => seriesId(report) === seriesId(latest),
  );
  const sections = latest.candidate.rows
    .map(row => {
      const rows = matching
        .map(report => {
          const value = report.candidate.rows.find(item => item.id === row.id);
          const metrics =
            kind === 'size'
              ? [value.raw, value.gzip, value.brotli]
              : (() => {
                  const stats = timingStatistics(value, report.settings);
                  return [
                    stats.median.toFixed(6),
                    stats.min.toFixed(6),
                    stats.max.toFixed(6),
                  ];
                })();
          return `<tr><th scope="row">${escapeHTML(report.candidate.revision.slice(0, 12))}</th><td>${escapeHTML(report.measuredAt)}</td>${metrics.map(metric => `<td>${escapeHTML(metric)}</td>`).join('')}</tr>`;
        })
        .join('');
      const values = trend(history, latest, row.id);
      const headers =
        kind === 'size'
          ? ['Raw B', 'Gzip B', 'Brotli B']
          : ['Median ms/op', 'Minimum ms/op', 'Maximum ms/op'];
      return `<section><h2>${escapeHTML(row.id)}</h2><p>Trend (lower is better): <span aria-hidden="true">${sparkline(values)}</span> <a href="#${row.id}">Read measurements</a></p><div class="scroll" tabindex="0" role="region" aria-label="${escapeHTML(row.id)} measurements"><table id="${row.id}"><caption>${escapeHTML(row.id)} history</caption><thead><tr><th scope="col">Revision</th><th scope="col">Measured</th>${headers.map(header => `<th scope="col">${header}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div></section>`;
    })
    .join('');
  return page(
    kind === 'size'
      ? 'Seroval bundle size history'
      : 'Seroval runtime speed history',
    `<nav aria-label="Benchmarks"><a href="../index.html">All reports</a> | <a href="../history.json">Raw history</a></nav>
<p>Latest compatible series: <code>${seriesId(latest)}</code>. Node ${escapeHTML(latest.settings.node)}, ${escapeHTML(latest.settings.cpu)}. ${records.length - matching.length} measurements from other series remain in raw history.</p>
<p>${kind === 'size' ? 'Production Seroval ESM import costs.' : 'Informational timings. Min–max ranges are not confidence intervals. Warm decode reuses code. Cold decode excludes process startup, import, and encoding. Stream completion measures emission, not decoding.'}</p>${sections}`,
  );
}

export function writeDashboard(history, output) {
  validateHistory(history);
  mkdirSync(output, { recursive: true });
  writeFileSync(
    resolve(output, 'history.json'),
    `${JSON.stringify(history)}\n`,
  );
  writeFileSync(
    resolve(output, 'index.html'),
    page(
      'Seroval benchmarks',
      '<p>Measurements of Seroval. Published history accepts only trusted default-branch runs.</p><ul><li><a href="size/index.html">Bundle size</a></li><li><a href="speed/index.html">Runtime speed</a></li></ul><p><a href="history.json">Raw history and measurement settings</a>. History retains the latest 200 report records.</p>',
    ),
  );
  for (const kind of ['size', 'speed']) {
    mkdirSync(resolve(output, kind), { recursive: true });
    writeFileSync(
      resolve(output, kind, 'index.html'),
      dashboard(history, kind),
    );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const { values } = parseArgs({
    options: {
      input: { type: 'string' },
      history: { type: 'string' },
      output: {
        type: 'string',
        default: resolve(import.meta.dirname, '../results/reports'),
      },
    },
  });
  assert.ok(values.input || values.history, 'Provide --input or --history');
  const history = values.history
    ? validateHistory(JSON.parse(readFileSync(values.history, 'utf8')))
    : { schemaVersion: 1, reports: [] };
  if (values.input) {
    const report = validateReport(
      JSON.parse(readFileSync(values.input, 'utf8')),
    );
    mkdirSync(values.output, { recursive: true });
    writeFileSync(
      resolve(values.output, `${report.kind}.md`),
      comment(report, history),
    );
  }
  if (values.history) {
    writeDashboard(history, values.output);
  }
}
