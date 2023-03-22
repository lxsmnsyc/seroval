/* eslint-disable no-void */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import util from 'util';
import {
  suite, add, cycle, complete, save,
} from 'benny';

// fixtures
import circularDedupe from './fixtures/circular-dedupe';
import circularSimple from './fixtures/circular-simple';
import dedupeObject from './fixtures/dedupe-object';
import largeCircularCollection from './fixtures/large-circular-collection';
import largeComplexCollection from './fixtures/large-complex-collection';
import largeDedupeCollection from './fixtures/large-dedupe-collection';
import largeInvalidKeysCollection from './fixtures/large-invalid-keys-collection';
import largeSimpleCollection from './fixtures/large-simple-collection';
import simpleObject from './fixtures/simple-object';
import smallCollection from './fixtures/small-collection';

// tools
import * as devalue from './tools/devalue';
import * as flatted from './tools/flatted';
import * as json from './tools/json';
import * as njson from './tools/next-json';
import * as oson from './tools/oson';
import * as serializeJS from './tools/serialize-javascript';
import * as seroval from './tools/seroval';
import * as superjson from './tools/superjson';
import * as tosource from './tools/tosource';
import * as warp10 from './tools/warp10';

const tools = [
  devalue,
  flatted,
  json,
  njson,
  oson,
  serializeJS,
  seroval,
  superjson,
  tosource,
  warp10,
];

const fixtures = {
  'circular-dedupe': circularDedupe,
  'circular-simple': circularSimple,
  'dedupe-object': dedupeObject,
  'large-circular-collection': largeCircularCollection,
  'large-complex-collection': largeComplexCollection,
  'large-dedupe-collection': largeDedupeCollection,
  'large-invalid-keys-collection': largeInvalidKeysCollection,
  'large-simple-collection': largeSimpleCollection,
  'simple-object': simpleObject,
  'small-collection': smallCollection,
};

Object.entries(fixtures).forEach(([key, value]) => {
  const suiteName = key;
  const getData = value as () => unknown;

  // Skip benchmarks that couldn't properly serialize and hydrate the structure.
  const toolsForFixture = tools.map((tool) => {
    let skip = false;
    try {
      skip = !util.isDeepStrictEqual(
        tool.fromString(tool.toString(getData())),
        getData(),
      );
    } catch {
      skip = true;
    }

    return { ...tool, utils: tool, skip };
  });

  void suite(
    `${suiteName} to string`,
    ...toolsForFixture.map(({ name, utils, skip }) => (skip ? add.skip : add)(name, () => {
      utils.toString(getData());
    })),
    cycle(),
    complete(),
    save({
      file: `${suiteName} to string`,
      folder: 'results/json',
    }),
    save({
      file: `${suiteName} to string`,
      folder: 'results/charts',
      format: 'chart.html',
    }),
    save({
      file: `${suiteName} to string`,
      folder: 'results/csv',
      format: 'csv',
    }),
  );

  void suite(
    `${suiteName} from string`,
    ...toolsForFixture.map(({ name, utils }) => (
      // This does not account for parse time since eval is cached.
      // skipped for now because it is not useful until a way to avoid eval cache is found.
      add.skip(name, () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const sampleOutput = utils.toString(getData());
        return () => {
          utils.fromString(sampleOutput);
        };
      })
    )),
    cycle(),
    complete(),
    save({
      file: `${suiteName} from string`,
      folder: 'results/json',
    }),
    save({
      file: `${suiteName} from string`,
      folder: 'results/charts',
      format: 'chart.html',
    }),
    save({
      file: `${suiteName} from string`,
      folder: 'results/csv',
      format: 'csv',
    }),
  );
});
