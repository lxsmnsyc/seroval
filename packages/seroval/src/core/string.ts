const MIN_JSON_STRINGIFY_LENGTH = 64;

// Every code unit the escape loop rewrites, and its escape. Single-character
// keys can never collide with a property of `Object.prototype`.
const ESCAPED: Record<string, string | undefined> = {
  '"': '\\"',
  '\\': '\\\\',
  '\n': '\\n',
  '\r': '\\r',
  '\b': '\\b',
  '\t': '\\t',
  '\f': '\\f',
  '<': '\\x3C',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
};

// The keys of `ESCAPED`. A native scan is far cheaper than the character
// loop, and most strings (object keys above all) need no escape.
const NEEDS_ESCAPE = /["\\\n\r\b\t\f<\u2028\u2029]/;

// JSON escapes these code units differently from Seroval's wire format and
// they cannot be patched afterwards; `<`, U+2028 and U+2029 pass through
// `JSON.stringify` untouched, so they are rewritten on its output instead.
const JSON_ESCAPE_DIFFERENCES =
  // biome-ignore lint/suspicious/noControlCharactersInRegex: Match the control characters that require the existing encoder.
  /[\x00-\x07\x0b\x0e-\x1f\ud800-\udfff]/;

const LESS_THAN = /</g;
const LINE_SEPARATOR = /\u2028/g;
const PARAGRAPH_SEPARATOR = /\u2029/g;

// Written by https://github.com/DylanPiercey and is distributed under the MIT license.
// Creates a JavaScript double quoted string and escapes all characters
// not listed as DoubleStringCharacters on
// Also includes "<" to escape "</script>" and "\" to avoid invalid escapes in the output.
// http://www.ecma-international.org/ecma-262/5.1/#sec-7.8.4
export function serializeString(str: string): string {
  if (!NEEDS_ESCAPE.test(str)) {
    return str;
  }
  if (
    str.length >= MIN_JSON_STRINGIFY_LENGTH &&
    !JSON_ESCAPE_DIFFERENCES.test(str)
  ) {
    let result = JSON.stringify(str).slice(1, -1);
    // JSON never emits these from an escape, so each one is an original
    // character that still needs Seroval's encoding.
    if (result.includes('<')) {
      result = result.replace(LESS_THAN, '\\x3C');
    }
    if (result.includes('\u2028')) {
      result = result.replace(LINE_SEPARATOR, '\\u2028');
    }
    if (result.includes('\u2029')) {
      result = result.replace(PARAGRAPH_SEPARATOR, '\\u2029');
    }
    return result;
  }
  let result = '';
  let lastPos = 0;
  let replacement: string | undefined;
  for (let i = 0, len = str.length; i < len; i++) {
    replacement = ESCAPED[str[i]];
    if (replacement) {
      result += str.slice(lastPos, i) + replacement;
      lastPos = i + 1;
    }
  }
  return result + str.slice(lastPos);
}

// Strings `JSON.parse` decodes exactly like the manual decoder below: only
// the escapes both formats share, and no raw quote or control character that
// JSON would reject. Anything else (`\x3C`, `\u2028`, unknown escapes) takes
// the manual decoder, which leaves unknown escapes untouched where JSON
// would decode or reject them.
const JSON_COMPATIBLE =
  // biome-ignore lint/suspicious/noControlCharactersInRegex: JSON rejects raw control characters.
  /^(?:[^"\\\x00-\x1f]|\\["\\nrbtf])*$/;

const ESCAPE_SEQUENCE = /(\\\\|\\"|\\n|\\r|\\b|\\t|\\f|\\u2028|\\u2029|\\x3C)/g;

function createUnescapedTable(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const char in ESCAPED) {
    result[ESCAPED[char] as string] = char;
  }
  return result;
}

// `ESCAPED` inverted; only reached through `ESCAPE_SEQUENCE`, whose every
// match is a key.
const UNESCAPED = /* @__PURE__ */ createUnescapedTable();

function deserializeReplacer(str: string): string {
  return UNESCAPED[str];
}

export function deserializeString(str: string): string {
  if (typeof str !== 'string') {
    // Some node fields reach here without String coercion; they still go
    // through `replace` so boxed strings and replace-alikes keep working.
    return (str as string).replace(ESCAPE_SEQUENCE, deserializeReplacer);
  }
  let index = str.indexOf('\\');
  if (index === -1) {
    return str;
  }
  if (JSON_COMPATIBLE.test(str)) {
    return JSON.parse('"' + str + '"') as string;
  }
  // Rewrites each escape `ESCAPED` produces back to its character, and
  // leaves anything else literal, without a per-match `replace` callback.
  let result = '';
  let lastPos = 0;
  const last = str.length - 1;
  while (index !== -1 && index < last) {
    let replacement: string | undefined;
    // Code units the escape spans, including the backslash.
    let length = 2;
    switch (str.charCodeAt(index + 1)) {
      case 92: // \
        replacement = '\\';
        break;
      case 34: // "
        replacement = '"';
        break;
      case 110: // n
        replacement = '\n';
        break;
      case 114: // r
        replacement = '\r';
        break;
      case 98: // b
        replacement = '\b';
        break;
      case 116: // t
        replacement = '\t';
        break;
      case 102: // f
        replacement = '\f';
        break;
      case 120: // x
        if (str.startsWith('3C', index + 2)) {
          replacement = '\x3C';
          length = 4;
        }
        break;
      case 117: // u
        if (str.startsWith('2028', index + 2)) {
          replacement = '\u2028';
          length = 6;
        } else if (str.startsWith('2029', index + 2)) {
          replacement = '\u2029';
          length = 6;
        }
        break;
      default:
        break;
    }
    if (replacement) {
      result += str.slice(lastPos, index) + replacement;
      lastPos = index + length;
      index = str.indexOf('\\', lastPos);
    } else {
      index = str.indexOf('\\', index + 1);
    }
  }
  return result + str.slice(lastPos);
}
