import { describe, expect, it, vi } from 'vitest';
import { createRpcSignal } from '../../src/index';

describe('createRpcSignal', () => {
  it('aborts once with the first reason', () => {
    const { signal, abort } = createRpcSignal();
    const listener = vi.fn();
    signal.onAbort(listener);
    expect(signal.aborted).toBe(false);
    abort('first');
    abort('second');
    expect(signal.aborted).toBe(true);
    expect(signal.reason).toBe('first');
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith('first');
  });

  it('does not call a removed listener or one added after the abort', () => {
    const { signal, abort } = createRpcSignal();
    const removed = vi.fn();
    signal.onAbort(removed)();
    abort();
    const late = vi.fn();
    signal.onAbort(late);
    expect(removed).not.toHaveBeenCalled();
    expect(late).not.toHaveBeenCalled();
  });

  it('runs every listener when one throws, then rethrows', () => {
    const { signal, abort } = createRpcSignal();
    const after = vi.fn();
    signal.onAbort(() => {
      throw new Error('listener');
    });
    signal.onAbort(after);
    expect(() => {
      abort();
    }).toThrow('listener');
    expect(after).toHaveBeenCalledOnce();
  });

  it('calls the same function twice when it was added twice', () => {
    const { signal, abort } = createRpcSignal();
    const listener = vi.fn();
    signal.onAbort(listener);
    signal.onAbort(listener);
    abort();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
