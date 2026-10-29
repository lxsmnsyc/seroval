import { describe, expect, it } from 'vitest';
import { v } from '../src';

describe('v', () => {
  it('validates primitives', () => {
    expect(v.string('a')).toBe(true);
    expect(v.string(1)).toBe(false);
    expect(v.number(1)).toBe(true);
    expect(v.number('1')).toBe(false);
    expect(v.boolean(true)).toBe(true);
    expect(v.boolean(0)).toBe(false);
    expect(v.bigint(1n)).toBe(true);
    expect(v.bigint(1)).toBe(false);
  });

  it('validates instances', () => {
    expect(v.arrayBuffer(new ArrayBuffer(1))).toBe(true);
    expect(v.arrayBuffer(new Uint8Array(1))).toBe(false);
    const isPromise = v.instanceOf(Promise);
    expect(isPromise(Promise.resolve())).toBe(true);
    // oxlint-disable-next-line unicorn/no-thenable -- A thenable is not a Promise.
    expect(isPromise({ then: () => undefined })).toBe(false);
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
    const either = v.union(v.string, v.number);
    expect(either('a')).toBe(true);
    expect(either(1)).toBe(true);
    expect(either(true)).toBe(false);

    const maybe = v.optional(v.string);
    expect(maybe(undefined)).toBe(true);
    expect(maybe('a')).toBe(true);
    expect(maybe(1)).toBe(false);

    const list = v.array(v.number);
    expect(list([1, 2, 3])).toBe(true);
    expect(list([1, '2'])).toBe(false);
    expect(list('nope')).toBe(false);
  });
});
