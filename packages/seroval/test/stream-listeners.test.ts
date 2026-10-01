import { describe, expect, it, vi } from 'vitest';
import { createStream, type StreamListener } from '../src';

function listener(): StreamListener<number> {
  return { next: vi.fn(), throw: vi.fn(), return: vi.fn() };
}

describe('stream listener cleanup', () => {
  it('keeps other listeners subscribed after removing the first listener', () => {
    const stream = createStream<number>();
    const first = listener();
    const second = listener();
    const third = listener();
    const offFirst = stream.on(first);
    const offSecond = stream.on(second);
    stream.on(third);
    offFirst();
    stream.next(1);
    expect(first.next).not.toHaveBeenCalled();
    expect(second.next).toHaveBeenCalledWith(1);
    expect(third.next).toHaveBeenCalledWith(1);
    offSecond();
    stream.return(2);
    expect(second.return).not.toHaveBeenCalled();
    expect(third.return).toHaveBeenCalledWith(2);
  });

  it('makes cleanup idempotent when a slot is reused', () => {
    const stream = createStream<number>();
    const off = stream.on(listener());
    off();
    const second = listener();
    stream.on(second);
    off();
    stream.next(1);
    expect(second.next).toHaveBeenCalledTimes(1);
  });

  it('does not skip the next listener when a callback unsubscribes itself', () => {
    const stream = createStream<number>();
    const first = listener();
    const second = listener();
    const off = stream.on(first);
    first.next = off;
    stream.on(second);
    stream.next(1);
    stream.next(2);
    expect(second.next).toHaveBeenCalledTimes(2);
  });

  it('keeps duplicate listener registrations independent', () => {
    const stream = createStream<number>();
    const shared = listener();
    const offFirst = stream.on(shared);
    const offSecond = stream.on(shared);
    offFirst();
    offFirst();
    stream.next(1);
    expect(shared.next).toHaveBeenCalledTimes(1);
    offSecond();
    stream.next(2);
    expect(shared.next).toHaveBeenCalledTimes(1);
  });

  it('can remove a later listener during dispatch', () => {
    const stream = createStream<number>();
    const first = listener();
    const second = listener();
    const third = listener();
    stream.on(first);
    first.next = stream.on(second);
    stream.on(third);
    stream.next(1);
    expect(second.next).not.toHaveBeenCalled();
    expect(third.next).toHaveBeenCalledWith(1);
  });

  it('ignores cleanup after completion', () => {
    const stream = createStream<number>();
    const first = listener();
    const off = stream.on(first);
    stream.return(1);
    off();
    off();
    expect(first.return).toHaveBeenCalledTimes(1);
  });
});
