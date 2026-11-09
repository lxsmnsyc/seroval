import { describe, expect, it } from 'vitest';
import {
  compileJSON,
  crossSerialize,
  deserialize,
  fromJSON,
  serialize,
  toJSON,
} from '../src';

// Own properties that pretend to be the constructor. The class check falls
// back to the prototype for these, so the value is still a typed array, and
// the name in the output must come from the array itself.
function spoof<T extends object>(value: T, constructor: unknown): T {
  Object.defineProperty(value, 'constructor', { value: constructor });
  return value;
}

const CASES = [
  () => spoof(new Uint8Array([1, 2, 3]), { name: 'alert(1)//' }),
  () => spoof(new Int16Array([-1, 2]), { name: '</script>' }),
  () => spoof(new BigInt64Array([1n, -2n]), { name: 'x()' }),
  () => spoof(new Float32Array([1.5]), Uint8Array),
];

describe('typed array constructor name', () => {
  it.each(CASES)('uses the real type of %#', make => {
    const value = make();
    const type = Object.prototype.toString.call(value).slice(8, -1);
    for (const output of [
      serialize(value),
      crossSerialize(value),
      compileJSON(toJSON(value)),
    ]) {
      expect(output.startsWith('new ' + type + '(') || output.includes('=new ' + type + '(')).toBe(true);
      expect(output).not.toContain('alert');
      expect(output).not.toContain('</script>');
      expect(output).not.toContain('x()');
    }
    for (const back of [deserialize<typeof value>(serialize(value)), fromJSON<typeof value>(toJSON(value))]) {
      expect(Object.prototype.toString.call(back)).toBe(`[object ${type}]`);
      expect([...back]).toEqual([...value]);
    }
  });

  it('copies a view with its real type when compacting', () => {
    const value = spoof(new Uint8Array(new ArrayBuffer(8), 2, 3), {
      name: 'alert(1)//',
    });
    value.set([7, 8, 9]);
    const output = serialize(value, { compactArrayBufferViews: true });
    expect(output.startsWith('new Uint8Array(')).toBe(true);
    expect([...deserialize<Uint8Array>(output)]).toEqual([7, 8, 9]);
  });
});
