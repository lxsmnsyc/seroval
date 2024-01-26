import { describe, expect, it } from 'vitest';
import { Feature, serializeAsync } from '../src';

describe('Promise', () => {
  describe('compat', () => {
    it('should use function expression instead of arrow functions', async () => {
      const example: Record<string, Promise<unknown>> = {};
      example.self = Promise.resolve(example);
      expect(
        await serializeAsync(example, {
          disabledFeatures: Feature.ArrowFunction,
        }),
      ).toMatchSnapshot();
    });
    it('should use function expression instead of arrow functions', async () => {
      const example: Record<string, Promise<unknown>> = {};
      example.self = Promise.reject(example);
      expect(
        await serializeAsync(example, {
          disabledFeatures: Feature.ArrowFunction,
        }),
      ).toMatchSnapshot();
    });
  });
});
