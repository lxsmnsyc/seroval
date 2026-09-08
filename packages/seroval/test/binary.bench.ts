import { bench, describe } from 'vitest';
import { fromJSON, toJSON } from '../src';

for (const length of [0, 64, 381, 384, 1024, 64 * 1024, 512 * 1024]) {
  const value = Uint8Array.from({ length }, (_, i) => i % 256).buffer;
  const json = toJSON(value);
  describe(`${length} bytes`, () => {
    bench('fromJSON', () => {
      fromJSON(json);
    });
  });
}
