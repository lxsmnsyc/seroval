import { describe, expect, it } from 'vitest';
import {
  SerovalDeserializationError,
  SerovalMissingPluginError,
  SerovalParserError,
  SerovalSerializationError,
  SerovalUnsupportedTypeError,
} from '../../src';

describe('step wrapper development message', () => {
  it('describes the unsupported value of a wrapped SRV001 error', () => {
    const inner = new SerovalUnsupportedTypeError(Symbol('x'));
    for (const error of [new SerovalParserError(inner), new SerovalSerializationError(inner)]) {
      expect(error.code).toBe('SRV001');
      expect(error.message).toBe(inner.message);
      expect(error.message).toContain('Symbol');
      expect(error.message).not.toContain('[object Undefined]');
    }
  });

  it('describes the tag of a wrapped SRV003 error', () => {
    const inner = new SerovalMissingPluginError('my/tag');
    const error = new SerovalDeserializationError(inner);
    expect(error.code).toBe('SRV003');
    expect(error.message).toBe(inner.message);
    expect(error.message).toContain('my/tag');
  });
});
