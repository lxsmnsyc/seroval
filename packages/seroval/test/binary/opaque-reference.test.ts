import { describe, expect, it } from 'vitest';
import { OpaqueReference } from '../../src';
import { roundtrip } from './utils';

describe('binary OpaqueReference', () => {
  it('hides the referenced value', async () => {
    const { value } = await roundtrip<{
      transparent: string;
      opaque: unknown;
    }>({
      transparent: 'This is transparent',
      opaque: new OpaqueReference('This is opaque'),
    });
    expect(value.transparent).toBe('This is transparent');
    expect(value.opaque).toBe(undefined);
  });

  it('serializes the replacement instead', async () => {
    const { value } = await roundtrip<{ opaque: unknown }>({
      opaque: new OpaqueReference('This is opaque', 'This is a dummy value.'),
    });
    expect(value.opaque).toBe('This is a dummy value.');
  });

  it('supports structured replacements', async () => {
    const { value } = await roundtrip<{ opaque: unknown }>({
      opaque: new OpaqueReference(() => 'not serializable', {
        kind: 'function',
        id: 1,
      }),
    });
    expect(value.opaque).toEqual({ kind: 'function', id: 1 });
  });

  it('hides values that could not otherwise be serialized', async () => {
    const { value } = await roundtrip<unknown[]>([
      new OpaqueReference(() => 'not serializable'),
    ]);
    expect(value).toEqual([undefined]);
  });
});
