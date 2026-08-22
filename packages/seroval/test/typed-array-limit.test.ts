import { describe, expect, it } from 'vitest';
import {
  type SerovalTypedArrayNode,
  fromJSON,
  serialize,
  toJSON,
} from '../src';

// Same cap as the ArrayBuffer deserialization limit (MAX_BASE64_LENGTH).
const MAX = 1_000_000;

describe('typed array length limit', () => {
  describe('serialization', () => {
    it('accepts a typed array at the limit', () => {
      expect(() => serialize(new Uint8Array(MAX))).not.toThrow();
    });

    it('rejects a typed array over the limit', () => {
      expect(() => serialize(new Uint8Array(MAX + 1))).toThrow();
    });

    it('rejects a bigint typed array over the limit', () => {
      expect(() => serialize(new BigInt64Array(MAX + 1))).toThrow();
    });

    it('rejects a DataView over the limit', () => {
      const view = new DataView(new ArrayBuffer(MAX + 1));
      expect(() => serialize(view)).toThrow();
    });
  });

  describe('deserialization', () => {
    it('rejects a typed array node claiming a length over the limit', () => {
      const json = toJSON(new Uint8Array([1, 2, 3]));
      (json.t as SerovalTypedArrayNode).l = MAX + 1;
      expect(() => fromJSON(json)).toThrow();
    });
  });
});
