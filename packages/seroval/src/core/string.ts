import { NIL } from './constants';

const MIN_JSON_STRINGIFY_LENGTH = 64;

// JSON escapes these code units differently from Seroval's wire format.
const JSON_ESCAPE_DIFFERENCES =
  // biome-ignore lint/suspicious/noControlCharactersInRegex: Match the control characters that require the existing encoder.
  /[\x00-\x07\x0b\x0e-\x1f<\u2028\u2029\ud800-\udfff]/;

export function serializeChar(str: string): string | undefined {
  switch (str) {
    case '"':
      return '\\"';
    case '\\':
      return '\\\\';
    case '\n':
      return '\\n';
    case '\r':
      return '\\r';
    case '\b':
      return '\\b';
    case '\t':
      return '\\t';
    case '\f':
      return '\\f';
    case '<':
      return '\\x3C';
    case '\u2028':
      return '\\u2028';
    case '\u2029':
      return '\\u2029';
    default:
      return NIL;
  }
}

// Written by https://github.com/DylanPiercey and is distributed under the MIT license.
// Creates a JavaScript double quoted string and escapes all characters
// not listed as DoubleStringCharacters on
// Also includes "<" to escape "</script>" and "\" to avoid invalid escapes in the output.
// http://www.ecma-international.org/ecma-262/5.1/#sec-7.8.4
export function serializeString(str: string): string {
  if (
    str.length >= MIN_JSON_STRINGIFY_LENGTH &&
    !JSON_ESCAPE_DIFFERENCES.test(str)
  ) {
    return JSON.stringify(str).slice(1, -1);
  }
  let result = '';
  let lastPos = 0;
  let replacement: string | undefined;
  for (let i = 0, len = str.length; i < len; i++) {
    replacement = serializeChar(str[i]);
    if (replacement) {
      result += str.slice(lastPos, i) + replacement;
      lastPos = i + 1;
    }
  }
  if (lastPos === 0) {
    result = str;
  } else {
    result += str.slice(lastPos);
  }
  return result;
}

function deserializeReplacer(str: string): string {
  switch (str) {
    case '\\\\':
      return '\\';
    case '\\"':
      return '"';
    case '\\n':
      return '\n';
    case '\\r':
      return '\r';
    case '\\b':
      return '\b';
    case '\\t':
      return '\t';
    case '\\f':
      return '\f';
    case '\\x3C':
      return '\x3C';
    case '\\u2028':
      return '\u2028';
    case '\\u2029':
      return '\u2029';
    default:
      return str;
  }
}

export function deserializeString(str: string): string {
  return str.replace(
    /(\\\\|\\"|\\n|\\r|\\b|\\t|\\f|\\u2028|\\u2029|\\x3C)/g,
    deserializeReplacer,
  );
}
