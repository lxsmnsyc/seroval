import { describe, expect, it } from 'vitest';
import CustomEventPlugin from '../../../web/custom-event';
import { roundtrip } from './utils';

const PLUGINS = [CustomEventPlugin];

describe('binary CustomEvent', () => {
  it('supports CustomEvent', async () => {
    const source = new CustomEvent('greet', {
      detail: { name: 'world' },
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    const { value } = await roundtrip<CustomEvent>(source, PLUGINS);
    expect(value).toBeInstanceOf(CustomEvent);
    expect(value.type).toBe('greet');
    expect(value.detail).toEqual({ name: 'world' });
    expect(value.bubbles).toBe(true);
    expect(value.cancelable).toBe(true);
    expect(value.composed).toBe(true);
  });

  it('supports a detail with exotic values', async () => {
    const detail = { when: new Date(0), tags: new Set(['a']), big: 1n };
    const { value } = await roundtrip<CustomEvent<typeof detail>>(
      new CustomEvent('exotic', { detail }),
      PLUGINS,
    );
    expect(value.detail.when).toBeInstanceOf(Date);
    expect(value.detail.tags).toEqual(new Set(['a']));
    expect(value.detail.big).toBe(1n);
  });

  it('supports a CustomEvent without detail', async () => {
    const { value } = await roundtrip<CustomEvent>(
      new CustomEvent('empty'),
      PLUGINS,
    );
    expect(value.type).toBe('empty');
    expect(value.detail).toBe(null);
  });
});
