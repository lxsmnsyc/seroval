# Object-key length benchmarks

This benchmark covers actual object properties, not standalone string values. It measures a synthetic range of short key lengths, not an observed real-world average.

## Results

Measured on 2026-09-28 with Node.js 26.10.0, Vitest 5.0.2, pnpm 10.25.0, and an Apple M4 (arm64, 16 GiB RAM, Darwin 24.6.0).

- Baseline runtime: upstream `f0e13f8222c18baa03227213aa44e44bb3cafd7a`.
- PR runtime: `0ab1bcd03647352712870ed677d515cc5157f0f6`, which includes that upstream revision.
- Both checkouts used the same fixture and lockfile. No production code changed during measurement.
- Five separate runs per revision, key shape, and length produced 120 reports and 360 operation measurements. All key-length and round-trip checks passed.

These are development-machine measurements without CPU isolation, not stable performance guarantees. The PR has lower median encoding times for every plain-key length, but higher median `fromJSON` times for every plain-key length. Two-unit escaped keys also have higher median encoding times. The ranges often overlap, so these observations do not establish small gains or regressions. They do not support a blanket claim that every operation is faster.

Each timing is the median of five per-run mean latencies, followed by the minimum and maximum of those means. Units are milliseconds per 20,000-object array. Positive time reduction means faster: `100 * (1 - PR median / baseline median)`. Negative values mean slower. Maximum RME is the largest within-run relative margin of error across both revisions' ten measurements for that row; it is not a confidence interval for the ratio. RME exceeded 10% in 94 of 360 measurements and reached 73.8%, so interpret the percentages cautiously.

[Per-run results](./results/object-key-lengths.csv) retain each mean, p99, RME, and sample count. No slow run was removed from these tables.

### Plain keys

| Code units | Operation | Baseline ms [min, max] | PR ms [min, max] | Time reduction | Max RME |
| --- | --- | --- | --- | --- | --- |
| 2 | serialize | 157.94 [128.39, 192.92] | 141.70 [118.60, 188.55] | 10.3% | 18.3% |
| 2 | toJSON | 96.99 [71.01, 126.69] | 73.24 [60.57, 142.86] | 24.5% | 39.5% |
| 2 | fromJSON | 45.45 [36.41, 61.93] | 45.62 [33.76, 57.28] | -0.4% | 11.2% |
| 4 | serialize | 172.24 [134.50, 216.70] | 143.34 [132.98, 167.06] | 16.8% | 29.3% |
| 4 | toJSON | 102.01 [76.36, 132.85] | 77.68 [65.40, 85.64] | 23.9% | 22.3% |
| 4 | fromJSON | 45.49 [42.44, 48.96] | 48.70 [37.31, 50.25] | -7.1% | 12.6% |
| 8 | serialize | 223.15 [154.75, 252.41] | 160.12 [108.31, 219.52] | 28.2% | 34.7% |
| 8 | toJSON | 146.32 [101.64, 165.47] | 74.27 [58.41, 121.65] | 49.2% | 51.1% |
| 8 | fromJSON | 44.83 [35.27, 54.08] | 49.55 [35.23, 59.93] | -10.5% | 21.1% |
| 12 | serialize | 193.64 [166.97, 339.79] | 118.90 [109.89, 154.48] | 38.6% | 39.7% |
| 12 | toJSON | 134.98 [124.88, 188.94] | 66.13 [59.11, 79.28] | 51.0% | 13.4% |
| 12 | fromJSON | 38.33 [36.72, 119.47] | 45.75 [37.46, 46.59] | -19.3% | 73.8% |
| 16 | serialize | 264.43 [213.91, 432.03] | 119.94 [109.76, 164.87] | 54.6% | 11.2% |
| 16 | toJSON | 205.95 [136.52, 338.71] | 64.90 [58.41, 115.39] | 68.5% | 17.0% |
| 16 | fromJSON | 37.66 [37.26, 94.81] | 37.90 [35.06, 65.34] | -0.6% | 22.3% |
| 32 | serialize | 357.64 [269.69, 429.03] | 133.59 [111.63, 248.17] | 62.6% | 38.6% |
| 32 | toJSON | 272.25 [204.95, 386.79] | 69.58 [56.71, 130.77] | 74.4% | 17.2% |
| 32 | fromJSON | 37.27 [32.20, 54.30] | 42.27 [36.26, 79.25] | -13.4% | 20.2% |

### Escape-heavy keys

| Code units | Operation | Baseline ms [min, max] | PR ms [min, max] | Time reduction | Max RME |
| --- | --- | --- | --- | --- | --- |
| 2 | serialize | 151.42 [135.51, 243.66] | 158.84 [116.73, 205.83] | -4.9% | 49.7% |
| 2 | toJSON | 81.74 [68.92, 83.90] | 82.80 [64.45, 121.45] | -1.3% | 15.6% |
| 2 | fromJSON | 79.10 [66.79, 93.35] | 62.57 [49.12, 118.05] | 20.9% | 26.2% |
| 4 | serialize | 183.99 [164.35, 221.14] | 171.26 [127.22, 366.74] | 6.9% | 61.2% |
| 4 | toJSON | 107.21 [85.55, 255.68] | 86.24 [74.01, 92.89] | 19.6% | 38.4% |
| 4 | fromJSON | 89.62 [67.36, 241.17] | 63.76 [52.53, 104.62] | 28.9% | 52.6% |
| 8 | serialize | 239.76 [191.59, 256.42] | 140.37 [130.82, 235.71] | 41.5% | 29.0% |
| 8 | toJSON | 132.52 [122.91, 220.80] | 83.46 [76.02, 103.90] | 37.0% | 31.5% |
| 8 | fromJSON | 74.39 [63.67, 112.49] | 52.08 [51.72, 71.21] | 30.0% | 15.3% |
| 12 | serialize | 211.38 [184.00, 330.88] | 157.74 [151.26, 230.57] | 25.4% | 10.1% |
| 12 | toJSON | 134.72 [118.72, 250.72] | 122.91 [92.26, 129.39] | 8.8% | 22.8% |
| 12 | fromJSON | 74.42 [62.76, 93.45] | 59.13 [55.17, 114.26] | 20.6% | 23.4% |
| 16 | serialize | 306.07 [202.65, 410.30] | 168.44 [135.02, 398.58] | 45.0% | 15.4% |
| 16 | toJSON | 221.95 [135.25, 542.50] | 89.82 [82.52, 218.83] | 59.5% | 39.8% |
| 16 | fromJSON | 102.36 [63.91, 126.61] | 71.51 [55.53, 117.25] | 30.1% | 27.7% |
| 32 | serialize | 357.05 [278.90, 556.93] | 188.03 [162.27, 348.47] | 47.3% | 36.2% |
| 32 | toJSON | 301.66 [221.60, 489.25] | 113.34 [102.73, 196.00] | 62.4% | 26.3% |
| 32 | fromJSON | 78.52 [63.41, 109.95] | 62.06 [59.59, 99.08] | 21.0% | 19.7% |

## Workload

The [fixture](../packages/seroval/test/object-key-length.bench.ts) creates an array of 20,000 distinct objects. Each object has four own properties with numeric values. Every key in a case is exactly 2, 4, 8, 12, 16, or 32 UTF-16 code units long. Object count, property count, values, and insertion order stay the same across lengths and revisions.

- Plain keys contain only ASCII letters. For example, the two-unit keys are `ax`, `bx`, `cx`, and `dx`.
- Escaped keys end in `"`, `\`, a newline, or `<`, one per property. This is an escape-heavy control, not a typical frequency estimate.
- `serialize` measures JavaScript serialization.
- `toJSON` measures parsing the input into Seroval's JSON representation.
- `fromJSON` measures decoding a precomputed representation. Encoding is outside the timed region.

Fixture creation, key-length checks, and both round-trip checks run before timing. Each operation has a 200 ms warmup with at least two iterations, then a 1,000 ms measurement with at least ten iterations. Each sample processes the whole 20,000-object array.

The original PR description's approximately 10% result did not include its fixture. This is a new, reproducible measurement, not a reconstruction of that result.

## Reproduce

Use Node.js 26.10.0 and pnpm 10.25.0 to match the recorded environment. Run the following from the PR checkout. `HEAD` must include the benchmark file.

```sh
set -eu
candidate=$(git rev-parse HEAD)
baseline=f0e13f8222c18baa03227213aa44e44bb3cafd7a
scratch=$(mktemp -d "${TMPDIR:-/tmp}/seroval-key-bench.XXXXXX")
git worktree add --detach "$scratch/base" "$baseline"
git worktree add --detach "$scratch/head" "$candidate"
cp "$scratch/head/packages/seroval/test/object-key-length.bench.ts" \
  "$scratch/base/packages/seroval/test/object-key-length.bench.ts"
mkdir "$scratch/results"
for version in base head; do
  (cd "$scratch/$version" && pnpm install --frozen-lockfile)
done
for round in 1 2 3 4 5; do
  for length in 2 4 8 12 16 32; do
    for kind in plain escaped; do
      if [ $((round % 2)) -eq 1 ]; then
        set -- base head
      else
        set -- head base
      fi
      for version do
        name="$version-$round-$kind-$length"
        (cd "$scratch/$version" && pnpm --filter seroval exec vitest bench \
          object-key-length --run \
          --testNamePattern "^$kind keys / $length code units$" \
          --reporter=json --outputFile="$scratch/results/$name.json")
      done
    done
  done
done
printf 'Raw reports: %s/results\n' "$scratch"
```

Run the revisions sequentially on the same machine, without other CPU-heavy work. Each invocation starts a fresh process for one key shape and length, so it does not retain other cases' fixtures. Alternate which revision runs first to reduce order bias. Preserve the result directory before removing the scratch worktrees.

Vitest 5 exposes `bench` through the test context. Its JSON reporter records each operation under `testResults[].assertionResults[].benchmarks[].tasks[]`. Read `latency.mean`, `latency.p99`, `latency.rme`, and `latency.samplesCount`; latency is in milliseconds per array.
