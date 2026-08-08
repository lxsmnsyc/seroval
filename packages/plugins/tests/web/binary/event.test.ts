import { describe, expect, it } from 'vitest';
import CustomEventPlugin from '../../../web/custom-event';
import EventPlugin from '../../../web/event';
import { roundtrip } from './utils';

describe('binary Event', () => {
  const PLUGINS = [EventPlugin];

  it('supports Event', async () => {
    const source = new Event('click', {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    const { value } = await roundtrip<Event>(source, PLUGINS);
    expect(value).toBeInstanceOf(Event);
    expect(value.type).toBe('click');
    expect(value.bubbles).toBe(true);
    expect(value.cancelable).toBe(true);
    expect(value.composed).toBe(true);
  });

  it('defaults the option flags', async () => {
    const { value } = await roundtrip<Event>(new Event('plain'), PLUGINS);
    expect(value.type).toBe('plain');
    expect(value.bubbles).toBe(false);
    expect(value.cancelable).toBe(false);
    expect(value.composed).toBe(false);
  });

  it('supports Events nested in structures', async () => {
    const { value } = await roundtrip<{ event: Event }>(
      { event: new Event('nested') },
      PLUGINS,
    );
    expect(value.event).toBeInstanceOf(Event);
    expect(value.event.type).toBe('nested');
  });
});

describe('binary CustomEvent', () => {
  const PLUGINS = [CustomEventPlugin];

  it('supports CustomEvent', async () => {
    const source = new CustomEvent('data', {
      detail: { hello: 'world' },
      bubbles: true,
    });
    const { value } = await roundtrip<CustomEvent>(source, PLUGINS);
    expect(value).toBeInstanceOf(CustomEvent);
    expect(value.type).toBe('data');
    expect(value.detail).toEqual({ hello: 'world' });
    expect(value.bubbles).toBe(true);
  });

  it('supports a null detail', async () => {
    const { value } = await roundtrip<CustomEvent>(
      new CustomEvent('empty'),
      PLUGINS,
    );
    expect(value.detail).toBe(null);
  });

  it('supports exotic details', async () => {
    const { value } = await roundtrip<CustomEvent>(
      new CustomEvent('exotic', { detail: new Map([['key', new Date(0)]]) }),
      PLUGINS,
    );
    const detail = value.detail as Map<string, Date>;
    expect(detail).toBeInstanceOf(Map);
    expect(detail.get('key')).toBeInstanceOf(Date);
  });

  it('supports a cyclic detail', async () => {
    interface Cyclic {
      self?: Cyclic;
    }
    const detail: Cyclic = {};
    detail.self = detail;
    const { value } = await roundtrip<CustomEvent>(
      new CustomEvent('cyclic', { detail }),
      PLUGINS,
    );
    const back = value.detail as Cyclic;
    expect(back.self).toBe(back);
  });
});
