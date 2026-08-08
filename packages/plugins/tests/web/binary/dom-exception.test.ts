import { describe, expect, it } from 'vitest';
import DOMExceptionPlugin from '../../../web/dom-exception';
import { roundtrip } from './utils';

const PLUGINS = [DOMExceptionPlugin];

describe('binary DOMException', () => {
  it('supports DOMException', async () => {
    const source = new DOMException('The operation was aborted', 'AbortError');
    const { value } = await roundtrip<DOMException>(source, PLUGINS);
    expect(value).toBeInstanceOf(DOMException);
    expect(value.name).toBe('AbortError');
    expect(value.message).toBe('The operation was aborted');
  });

  it('defaults to Error when no name is given', async () => {
    const { value } = await roundtrip<DOMException>(
      new DOMException('plain'),
      PLUGINS,
    );
    expect(value.name).toBe('Error');
    expect(value.message).toBe('plain');
  });

  it('supports an empty message', async () => {
    const { value } = await roundtrip<DOMException>(
      new DOMException('', 'DataError'),
      PLUGINS,
    );
    expect(value.message).toBe('');
    expect(value.name).toBe('DataError');
  });

  it('supports DOMExceptions nested in structures', async () => {
    const { value } = await roundtrip<{ error: DOMException }>(
      { error: new DOMException('nested', 'NotFoundError') },
      PLUGINS,
    );
    expect(value.error).toBeInstanceOf(DOMException);
    expect(value.error.name).toBe('NotFoundError');
  });
});
