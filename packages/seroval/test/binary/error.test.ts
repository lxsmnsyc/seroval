import { describe, expect, it } from 'vitest';
import { roundtrip } from './utils';

describe('binary Error', () => {
  it('supports Error', async () => {
    const source = new Error('boom');
    const { value } = await roundtrip<Error>(source);
    expect(value).toBeInstanceOf(Error);
    expect(value.name).toBe('Error');
    expect(value.message).toBe('boom');
    expect(value.stack).toBe(source.stack);
  });

  it('supports every built-in Error constructor', async () => {
    const source = [
      new EvalError('eval'),
      new RangeError('range'),
      new ReferenceError('reference'),
      new SyntaxError('syntax'),
      new TypeError('type'),
      new URIError('uri'),
    ];
    const { value } = await roundtrip<Error[]>(source);
    expect(value[0]).toBeInstanceOf(EvalError);
    expect(value[1]).toBeInstanceOf(RangeError);
    expect(value[2]).toBeInstanceOf(ReferenceError);
    expect(value[3]).toBeInstanceOf(SyntaxError);
    expect(value[4]).toBeInstanceOf(TypeError);
    expect(value[5]).toBeInstanceOf(URIError);
    expect(value.map(error => error.message)).toEqual([
      'eval',
      'range',
      'reference',
      'syntax',
      'type',
      'uri',
    ]);
  });

  it('supports empty messages', async () => {
    const { value } = await roundtrip<Error>(new Error());
    expect(value.message).toBe('');
  });

  it('supports a custom name', async () => {
    const source = new Error('named');
    source.name = 'CustomName';
    const { value } = await roundtrip<Error>(source);
    expect(value.name).toBe('CustomName');
  });

  it('supports subclasses by name', async () => {
    class CustomError extends Error {}
    const { value } = await roundtrip<Error>(new CustomError('subclassed'));
    expect(value).toBeInstanceOf(Error);
    expect(value.name).toBe('CustomError');
    expect(value.message).toBe('subclassed');
  });

  it('supports the cause option', async () => {
    const { value } = await roundtrip<Error>(
      new Error('outer', { cause: new TypeError('inner') }),
    );
    expect(value.cause).toBeInstanceOf(TypeError);
    expect((value.cause as Error).message).toBe('inner');
  });

  it('supports extra own properties', async () => {
    const source = Object.assign(new Error('with data'), {
      code: 'E_TEST',
      payload: { retry: true },
    });
    const { value } = await roundtrip<Error & { code: string }>(source);
    expect(value.code).toBe('E_TEST');
    expect((value as unknown as { payload: unknown }).payload).toEqual({
      retry: true,
    });
  });

  it('supports self-referencing Errors', async () => {
    const source = new Error('cyclic') as Error & { self?: Error };
    source.self = source;
    const { value } = await roundtrip<Error & { self?: Error }>(source);
    expect(value.self).toBe(value);
  });

  it('supports AggregateError', async () => {
    const { value } = await roundtrip<AggregateError>(
      new AggregateError([new Error('a'), new Error('b')], 'aggregated'),
    );
    expect(value).toBeInstanceOf(AggregateError);
    expect(value.message).toBe('aggregated');
    expect(value.errors).toHaveLength(2);
    expect(value.errors[0]).toBeInstanceOf(Error);
    expect(value.errors[0].message).toBe('a');
    expect(value.errors[1].message).toBe('b');
  });

  it('supports an empty AggregateError', async () => {
    const { value } = await roundtrip<AggregateError>(
      new AggregateError([], 'empty'),
    );
    expect(value).toBeInstanceOf(AggregateError);
    expect(value.errors).toEqual([]);
  });
});
