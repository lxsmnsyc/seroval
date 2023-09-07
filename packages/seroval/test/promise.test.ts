import { describe, it, expect } from 'vitest';
import type { SerovalJSON } from '../src';
import {
  Feature,
  serializeAsync,
  toJSONAsync,
} from '../src';

describe('Promise', () => {
  describe('compat', () => {
    it('should throw an error for unsupported target', async () => {
      await expect(async (): Promise<string> => serializeAsync(Promise.resolve('test'), {
        disabledFeatures: Feature.Promise,
      }))
        .rejects
        .toThrowErrorMatchingSnapshot();
    });
    it('should use function expression instead of arrow functions', async () => {
      const example: Record<string, Promise<unknown>> = {};
      example.self = Promise.resolve(example);
      expect(await serializeAsync(example, {
        disabledFeatures: Feature.ArrowFunction,
      }))
        .toMatchSnapshot();
    });
    it('should use function expression instead of arrow functions', async () => {
      const example: Record<string, Promise<unknown>> = {};
      example.self = Promise.reject(example);
      expect(await serializeAsync(example, {
        disabledFeatures: Feature.ArrowFunction,
      }))
        .toMatchSnapshot();
    });
  });
  describe('compat#toJSON', () => {
    it('should throw an error for unsupported target', async () => {
      await expect(async (): Promise<SerovalJSON> => toJSONAsync(Promise.resolve('test'), {
        disabledFeatures: Feature.Promise,
      }))
        .rejects
        .toThrowErrorMatchingSnapshot();
    });
  });
});
