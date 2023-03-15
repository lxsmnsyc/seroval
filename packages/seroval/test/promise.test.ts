import { describe, it, expect } from 'vitest';
import {
  serializeAsync, toJSONAsync,
} from '../src';

describe('Promise', () => {
  describe('compat', () => {
    it('should throw an error for unsupported target', async () => {
      await expect(() => serializeAsync(Promise.resolve('test'), { target: 'es5' }))
        .rejects
        .toThrowErrorMatchingSnapshot();
    });
  });
  describe('compat#toJSON', () => {
    it('should throw an error for unsupported target', async () => {
      await expect(() => toJSONAsync(Promise.resolve('test'), { target: 'es5' }))
        .rejects
        .toThrowErrorMatchingSnapshot();
    });
  });
});
