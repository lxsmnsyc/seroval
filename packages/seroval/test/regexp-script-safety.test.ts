import { describe, expect, it } from 'vitest';
import { compileJSON, crossSerialize, deserialize, serialize, toJSON } from '../src';

// Sources whose `<` could close or confuse a script element if it reached the
// output unescaped, plus syntax that needs a literal `<` in the pattern.
const UNSAFE = [
  /[</script><script>alert(1)//]/,
  /[</SCRIPT>]/i,
  /[<!--]/,
  /(?<name>a)\k<name>/u,
  /(?<=a)b(?<!c)/,
  /[<"\\]/v,
];

const SAFE = [/[a-z0-9]+/i, /\d+\.\d+\s?\/\w*/g, /[/]/];

function hasRawTag(output: string): boolean {
  return /<\/script|<!--/i.test(output);
}

describe('RegExp script safety', () => {
  it.each(UNSAFE)('keeps %s out of the script element', (value) => {
    for (const output of [serialize(value), crossSerialize(value), compileJSON(toJSON(value))]) {
      expect(output).not.toContain('<');
      expect(hasRawTag(output)).toBe(false);
    }
    const back = deserialize<RegExp>(serialize(value));
    expect(back).toBeInstanceOf(RegExp);
    expect(back.source).toBe(value.source);
    expect(back.flags).toBe(value.flags);
  });

  it.each(SAFE)('keeps the literal form for %s', (value) => {
    expect(serialize(value)).toBe(String(value));
  });
});
