import { bench, describe } from 'vitest';
import { serialize, toJSON } from '../src';

const record = JSON.stringify({ id: 1, text: 'a"b\\c\n', active: true });
const cases = [
  ['short key', 'queryHash'],
  ['short escaped value', 'a"b\\c\n'],
  ['1 KiB plain text', 'x'.repeat(1024)],
  ['1 KiB JSON text', record.repeat(32).slice(0, 1024)],
  ['64 KiB JSON text', record.repeat(2048).slice(0, 65536)],
  ['1 MiB JSON text', record.repeat(32768).slice(0, 1048576)],
  ['HTML text', '<p>Text</p>\u2028'.repeat(8192)],
  ['surrogate fallback', '\ud83d\ude00'.repeat(32768)],
] as const;

for (const [name, value] of cases) {
  describe(name, () => {
    bench('serialize', () => {
      serialize(value);
    });
    bench('toJSON', () => {
      toJSON(value);
    });
  });
}
