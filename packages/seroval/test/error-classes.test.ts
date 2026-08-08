import { describe, expect, it } from 'vitest';
import {
  type SerovalNode,
  SerovalConflictedNodeIdError,
  SerovalDepthLimitError,
  SerovalDeserializationError,
  SerovalError,
  SerovalMalformedBinarySourceError,
  SerovalMalformedBinaryTypeError,
  SerovalMalformedNodeError,
  SerovalMissingBinaryRefError,
  SerovalMissingInstanceError,
  SerovalMissingPluginError,
  SerovalMissingReferenceError,
  SerovalMissingReferenceForIdError,
  SerovalParserError,
  SerovalSerializationError,
  SerovalUnexpectedBinaryTypeError,
  SerovalUnknownBinaryTypeError,
  SerovalUnknownTypedArrayError,
  SerovalUnsupportedNodeError,
  SerovalUnsupportedTypeError,
} from '../src';

// A minimal node stand-in for the errors that format a node.
const NODE = { t: 0, i: 3, s: undefined } as unknown as SerovalNode;

describe('error classes', () => {
  it('SerovalError carries the underlying cause', () => {
    const cause = new TypeError('root cause');
    const error = new SerovalError('parsing', cause);
    expect(error).toBeInstanceOf(Error);
    expect(error.cause).toBe(cause);
    expect(error.message).toContain('root cause');
  });

  it('SerovalError formats a non-Error cause', () => {
    const error = new SerovalError('parsing', 'a plain string');
    // Non-Error causes are rendered via Object.prototype.toString.
    expect(error.message).toContain('[object String]');
    expect(error.cause).toBe('a plain string');
  });

  it('the step errors extend SerovalError with their phase', () => {
    const cause = new Error('boom');
    for (const Ctor of [
      SerovalParserError,
      SerovalSerializationError,
      SerovalDeserializationError,
    ]) {
      const error = new Ctor(cause);
      expect(error).toBeInstanceOf(SerovalError);
      expect(error.cause).toBe(cause);
    }
  });

  it('constructs the value/tag errors with a message', () => {
    const cases: Error[] = [
      new SerovalUnsupportedTypeError(() => 0),
      new SerovalUnsupportedTypeError(Symbol('x')),
      new SerovalUnsupportedNodeError(NODE),
      new SerovalMissingPluginError('MyPlugin'),
      new SerovalMissingInstanceError('MyInstance'),
      new SerovalMissingReferenceError({ some: 'value' }),
      new SerovalMissingReferenceForIdError('the-id'),
      new SerovalUnknownTypedArrayError(),
      new SerovalMalformedNodeError(NODE),
      new SerovalConflictedNodeIdError(NODE),
      new SerovalDepthLimitError(64),
    ];
    for (const error of cases) {
      expect(error).toBeInstanceOf(Error);
      expect(error.message.length).toBeGreaterThan(0);
    }
  });

  it('keeps the offending value/id on the reference errors', () => {
    const value = { some: 'value' };
    expect(new SerovalMissingReferenceError(value).value).toBe(value);
    expect(new SerovalUnsupportedTypeError(value).value).toBe(value);
  });

  it('constructs the binary errors with a message', () => {
    const cases: Error[] = [
      new SerovalMalformedBinarySourceError(),
      new SerovalMalformedBinaryTypeError(3),
      new SerovalUnknownBinaryTypeError(200),
      new SerovalMissingBinaryRefError(42),
      new SerovalUnexpectedBinaryTypeError(7, 18, 27),
    ];
    for (const error of cases) {
      expect(error).toBeInstanceOf(Error);
      expect(error.message.length).toBeGreaterThan(0);
    }
  });
});
