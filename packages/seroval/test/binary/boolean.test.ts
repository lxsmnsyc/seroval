import { describe, expect, it } from 'vitest';
import { roundtrip } from './utils';

describe('binary constants', () => {
  it('supports true', async () => {
    const { value } = await roundtrip<boolean>(true);
    expect(value).toBe(true);
  });

  it('supports false', async () => {
    const { value } = await roundtrip<boolean>(false);
    expect(value).toBe(false);
  });

  it('supports null', async () => {
    const { value } = await roundtrip<null>(null);
    expect(value).toBe(null);
  });

  it('supports undefined', async () => {
    const { value } = await roundtrip<undefined>(undefined);
    expect(value).toBe(undefined);
  });

  it('supports constants inside a structure', async () => {
    const { value } = await roundtrip<unknown[]>([true, false, null, undefined]);
    expect(value).toEqual([true, false, null, undefined]);
    expect(value).toHaveLength(4);
    expect(3 in value).toBe(true);
  });
});
