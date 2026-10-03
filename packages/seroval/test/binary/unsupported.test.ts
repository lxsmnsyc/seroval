import { describe, expect, it } from 'vitest';
import { Feature } from '../../src';
import { captureSerializeError, roundtrip } from './utils';

function makeDeepObject(depth: number): Record<string, unknown> {
  let current: Record<string, unknown> = {};
  const root = current;
  for (let i = 0; i < depth; i++) {
    current.next = {};
    current = current.next as Record<string, unknown>;
  }
  return root;
}

describe('binary unsupported values', () => {
  it('rejects functions', async () => {
    const error = await captureSerializeError(() => 'nope');
    expect(error).toBeInstanceOf(Error);
  });

  it('rejects class instances without a plugin', async () => {
    class Unknown {
      value = 1;
    }
    const error = await captureSerializeError(new Unknown());
    expect(error).toBeInstanceOf(Error);
  });

  it('rejects WeakMap', async () => {
    const error = await captureSerializeError(new WeakMap());
    expect(error).toBeInstanceOf(Error);
  });

  it('respects depthLimit', async () => {
    const error = await captureSerializeError(makeDeepObject(5), {
      depthLimit: 2,
    });
    expect(error).toBeInstanceOf(Error);
    expect(String(error)).toContain('Depth limit');
  });

  it('allows structures within the depth limit', async () => {
    const { value } = await roundtrip<Record<string, unknown>>(
      makeDeepObject(2),
      { serialize: { depthLimit: 10 } },
    );
    expect(value.next).toBeDefined();
  });

  it('rejects disabled features on serialization', async () => {
    const error = await captureSerializeError(/pattern/, {
      disabledFeatures: Feature.RegExp,
    });
    expect(error).toBeInstanceOf(Error);
  });
});
