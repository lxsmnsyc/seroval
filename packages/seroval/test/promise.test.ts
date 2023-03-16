import { describe, it, expect } from 'vitest';
import {
  Feature,
  serializeAsync, toJSONAsync,
} from '../src';

describe('Promise', () => {
  describe('compat', () => {
    it('should throw an error for unsupported target', async () => {
      await expect(() => serializeAsync(Promise.resolve('test'), {
        disabledFeatures: Feature.Promise,
      }))
        .rejects
        .toThrowErrorMatchingSnapshot();
    });
  });
  describe('compat#toJSON', () => {
    it('should throw an error for unsupported target', async () => {
      await expect(() => toJSONAsync(Promise.resolve('test'), {
        disabledFeatures: Feature.Promise,
      }))
        .rejects
        .toThrowErrorMatchingSnapshot();
    });
  });
});
