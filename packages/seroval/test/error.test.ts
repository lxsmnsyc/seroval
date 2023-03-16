import { describe, it, expect } from 'vitest';
import {
  serialize,
  serializeAsync,
  toJSON,
  toJSONAsync,
} from '../src';

describe('Error', () => {
  describe('serialize', () => {
    it('supports Error.prototype.name', () => {
      const a = new Error('A');
      a.name = 'ExampleError';
      a.stack = '';
      expect(serialize(a)).toMatchSnapshot();
    });
    it('supports Error.prototype.cause', () => {
      const a = new Error('A');
      const b = new Error('B', { cause: a });
      a.stack = '';
      b.stack = '';
      expect(serialize(b)).toMatchSnapshot();
    });
    it('supports other Error classes', () => {
      const a = new ReferenceError('A');
      a.stack = '';
      expect(serialize(a)).toMatchSnapshot();
    });
  });
  describe('serializeAsync', () => {
    it('supports Error.prototype.name', async () => {
      const a = new Error('A');
      a.name = 'ExampleError';
      a.stack = '';
      expect(await serializeAsync(Promise.resolve(a))).toMatchSnapshot();
    });
    it('supports Error.prototype.cause', async () => {
      const a = new Error('A');
      const b = new Error('B', { cause: Promise.resolve(a) });
      a.stack = '';
      b.stack = '';
      expect(await serializeAsync(b)).toMatchSnapshot();
    });
    it('supports other Error classes', async () => {
      const a = new ReferenceError('A');
      a.stack = '';
      expect(await serializeAsync(Promise.resolve(a))).toMatchSnapshot();
    });
  });
  describe('toJSON', () => {
    it('supports Error.prototype.name', () => {
      const a = new Error('A');
      a.name = 'ExampleError';
      a.stack = '';
      expect(JSON.stringify(toJSON(a))).toMatchSnapshot();
    });
    it('supports Error.prototype.cause', () => {
      const a = new Error('A');
      const b = new Error('B', { cause: a });
      a.stack = '';
      b.stack = '';
      expect(JSON.stringify(toJSON(b))).toMatchSnapshot();
    });
    it('supports other Error classes', () => {
      const a = new ReferenceError('A');
      a.stack = '';
      expect(JSON.stringify(toJSON(a))).toMatchSnapshot();
    });
  });
  describe('toJSONAsync', () => {
    it('supports Error.prototype.name', async () => {
      const a = new Error('A');
      a.name = 'ExampleError';
      a.stack = '';
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(a))),
      ).toMatchSnapshot();
    });
    it('supports Error.prototype.cause', async () => {
      const a = new Error('A');
      const b = new Error('B', { cause: Promise.resolve(a) });
      a.stack = '';
      b.stack = '';
      expect(
        JSON.stringify(await toJSONAsync(b)),
      ).toMatchSnapshot();
    });
    it('supports other Error classes', async () => {
      const a = new ReferenceError('A');
      a.stack = '';
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(a))),
      ).toMatchSnapshot();
    });
  });
});
