import { describe, expect, it } from 'vitest';
import {
  type SerovalNode,
  createCrossDeserializer,
  fromCrossJSON,
  fromJSON,
  toCrossJSON,
  toJSON,
} from '../src';

// Unicode property escapes are expensive for the engine to build, even though
// a decoded RegExp is never run. The decoder limits how many one call builds.
const EMOJI = '[' + '\\p{RGI_Emoji}'.repeat(400) + ']';

function withSource<T extends { t: SerovalNode }>(json: T, source: string, flags: string): T {
  Object.assign(json.t, { c: source, m: flags });
  return json;
}

describe('RegExp construction budget', () => {
  it('rejects a pattern with many property escapes', () => {
    expect(() => fromJSON(withSource(toJSON(/a/v), EMOJI, 'v'))).toThrow();
    expect(() =>
      fromCrossJSON(
        Object.assign(toCrossJSON(/a/v), { c: EMOJI, m: 'v' }),
        { refs: new Map() },
      ),
    ).toThrow();
  });

  it('counts property escapes across every RegExp in one call', () => {
    const many = Array.from({ length: 40 }, (_, i) => new RegExp('\\p{L}' + i, 'u'));
    expect(() => fromJSON(toJSON(many))).toThrow();
    expect(() => fromCrossJSON(toCrossJSON(many), { refs: new Map() })).toThrow();
  });

  it('starts a new budget for each record of a session', () => {
    const session = createCrossDeserializer({});
    // One sender-side refs map keeps ids unique across the records.
    const refs = new Map<unknown, number>();
    for (let i = 0; i < 10; i++) {
      const value = Array.from({ length: 4 }, (_, k) => new RegExp('\\p{L}' + i + k, 'u'));
      expect(() => session.deserialize(toCrossJSON(value, { refs }))).not.toThrow();
    }
  });

  it('still decodes ordinary patterns', () => {
    const values = [
      /\p{L}+/u,
      /\p{RGI_Emoji}/v,
      /[\p{Script=Greek}\p{Script=Latin}]/u,
      /\p{p}/,
      /a{1,65535}[\u{0}-\u{10FFFF}]/iu,
      new RegExp('x'.repeat(20000)),
    ];
    const back = fromJSON<RegExp[]>(toJSON(values));
    expect(back.map((value) => value.source)).toEqual(values.map((value) => value.source));
  });
});
