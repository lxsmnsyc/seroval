import { describe, it, expect } from 'vitest';
import {
  AsyncServerValue,
  Feature,
  serializeAsync,
  toJSONAsync,
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
    it('should use function expression instead of arrow functions', async () => {
      const example: Record<string, AsyncServerValue> = {};
      example.self = Promise.resolve(example);
      expect(await serializeAsync(example, {
        disabledFeatures: Feature.ArrowFunction,
      }))
        .toMatchSnapshot();
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
