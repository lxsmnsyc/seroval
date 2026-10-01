import { describe, expect, it } from 'vitest';
import {
  fromJSON,
  SerovalDeserializationError,
  SerovalMalformedNodeError,
  toJSON,
} from '../src';
import { SerovalNodeType } from '../src/core/constants';

function cause(callback: () => unknown): unknown {
  try {
    callback();
  } catch (error) {
    expect(error).toBeInstanceOf(SerovalDeserializationError);
    if (error instanceof SerovalDeserializationError) {
      return error.cause;
    }
    throw error;
  }
  throw new Error('Expected deserialization failure');
}

describe('decoder validation ordering', () => {
  it('resolves the typed constructor before deserializing the buffer', () => {
    const json = toJSON(new Uint8Array(2));
    if (json.t.t !== SerovalNodeType.TypedArray) {
      throw new Error('Wrong fixture');
    }
    Object.defineProperty(json.t, 's', { value: 999 });
    Object.defineProperty(json.t, 'f', {
      get() {
        throw new Error('buffer read first');
      },
    });
    expect(cause(() => fromJSON(json))).toBeInstanceOf(
      SerovalMalformedNodeError,
    );
  });

  it.each(['typed', 'data'] as const)(
    'deserializes the %s buffer before offset validation',
    kind => {
      const json = toJSON(
        kind === 'typed' ? new Uint8Array(2) : new DataView(new ArrayBuffer(2)),
      );
      if (
        json.t.t !== SerovalNodeType.TypedArray &&
        json.t.t !== SerovalNodeType.DataView
      ) {
        throw new Error('Wrong fixture');
      }
      const failure = new Error('buffer first');
      Object.defineProperty(json.t, 'f', {
        get() {
          throw failure;
        },
      });
      json.t.b = -1;
      expect(cause(() => fromJSON(json))).toBe(failure);
    },
  );

  it.each(['typed', 'data'] as const)(
    'validates the %s offset before registering its id',
    kind => {
      const json = toJSON(
        kind === 'typed' ? new Uint8Array(2) : new DataView(new ArrayBuffer(2)),
      );
      if (
        json.t.t !== SerovalNodeType.TypedArray &&
        json.t.t !== SerovalNodeType.DataView
      ) {
        throw new Error('Wrong fixture');
      }
      json.t.b = -1;
      json.t.i = -1;
      const error = cause(() => fromJSON(json));
      expect(error).toBeInstanceOf(SerovalMalformedNodeError);
      expect((error as Error).message).toContain(`"${json.t.t}"`);
    },
  );
});
