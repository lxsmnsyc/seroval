import { describe, expect, it } from 'vitest';
import * as all from '../src';
import * as read from '../src/read';
import * as shared from '../src/shared';
import * as write from '../src/write';

const READ_ONLY = ['createCrossDeserializer', 'deserialize', 'fromCrossJSON', 'fromJSON'];
const WRITE_ONLY = [
  'Serializer',
  'compileJSON',
  'crossSerialize',
  'crossSerializeAsync',
  'crossSerializeStream',
  'getCrossReferenceHeader',
  'serialize',
  'serializeAsync',
  'toCrossJSON',
  'toCrossJSONAsync',
  'toCrossJSONStream',
  'toJSON',
  'toJSONAsync',
];

describe('entry points', () => {
  it('splits reading from writing', () => {
    expect(Object.keys(read).sort()).toEqual([...Object.keys(shared), ...READ_ONLY].sort());
    expect(Object.keys(write).sort()).toEqual([...Object.keys(shared), ...WRITE_ONLY].sort());
  });
  it('exports everything from the root', () => {
    expect(Object.keys(all).sort()).toEqual(
      [...Object.keys(shared), ...READ_ONLY, ...WRITE_ONLY].sort(),
    );
  });
  it('shares the same values between entry points', () => {
    for (const key of Object.keys(shared)) {
      const value = shared[key as keyof typeof shared];
      expect(read[key as keyof typeof read]).toBe(value);
      expect(write[key as keyof typeof write]).toBe(value);
      expect(all[key as keyof typeof all]).toBe(value);
    }
  });
});
