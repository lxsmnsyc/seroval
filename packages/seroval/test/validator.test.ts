import { describe, expect, it } from 'vitest';
import { v } from '../src';

describe('validator helpers', () => {
  it('validates primitives', () => {
    expect(v.string('a')).toBe(true);
    expect(v.string(1)).toBe(false);
    expect(v.number(1)).toBe(true);
    expect(v.number('1')).toBe(false);
    expect(v.boolean(true)).toBe(true);
    expect(v.bigint(1n)).toBe(true);
    expect(v.bigint(1)).toBe(false);
  });

  it('validates thenables', () => {
    expect(v.thenable(Promise.resolve(1))).toBe(true);
    expect(v.thenable({ then: () => undefined })).toBe(true);
    expect(v.thenable({ then: 1 })).toBe(false);
    expect(v.thenable(null)).toBe(false);
  });

  it('validates instances', () => {
    const isBuffer = v.instanceOf(ArrayBuffer);
    expect(isBuffer(new ArrayBuffer(4))).toBe(true);
    expect(isBuffer(new Uint8Array(4))).toBe(false);
    expect(v.arrayBuffer(new ArrayBuffer(1))).toBe(true);
  });

  it('validates object shapes and ignores extra keys', () => {
    const guard = v.object({ type: v.string, size: v.number });
    expect(guard({ type: 'a', size: 1, extra: true })).toBe(true);
    expect(guard({ type: 'a', size: '1' })).toBe(false);
    expect(guard({ type: 'a' })).toBe(false);
    expect(guard(null)).toBe(false);
    expect(guard(42)).toBe(false);
  });

  it('composes union, optional and array', () => {
    const guard = v.union(v.string, v.number);
    expect(guard('a')).toBe(true);
    expect(guard(1)).toBe(true);
    expect(guard(true)).toBe(false);

    const opt = v.optional(v.string);
    expect(opt(undefined)).toBe(true);
    expect(opt('a')).toBe(true);
    expect(opt(1)).toBe(false);

    const list = v.array(v.number);
    expect(list([1, 2, 3])).toBe(true);
    expect(list([1, '2'])).toBe(false);
    expect(list('nope')).toBe(false);
  });
});
