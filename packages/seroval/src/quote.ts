// Written by https://github.com/DylanPiercey and is distributed under the MIT license.
// Creates a JavaScript double quoted string and escapes all characters
// not listed as DoubleStringCharacters on
// Also includes "<" to escape "</script>" and "\" to avoid invalid escapes in the output.
// http://www.ecma-international.org/ecma-262/5.1/#sec-7.8.4
export default function quote(str: string) {
  let result = '';
  let lastPos = 0;
  for (let i = 0, len = str.length; i < len; i++) {
    let replacement;
    switch (str[i]) {
      case '"':
        replacement = '\\"';
        break;
      case '\\':
        replacement = '\\\\';
        break;
      case '<':
        replacement = '\\x3C';
        break;
      case '\n':
        replacement = '\\n';
        break;
      case '\r':
        replacement = '\\r';
        break;
      case '\u2028':
        replacement = '\\u2028';
        break;
      case '\u2029':
        replacement = '\\u2029';
        break;
      default:
        continue;
    }
    result += str.slice(lastPos, i) + replacement;
    lastPos = i + 1;
  }
  if (lastPos === 0) {
    result = str;
  } else {
    result += str.slice(lastPos);
  }
  return result;
}

export function invQuote(str: string): string {
  return str
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .replace(/\\x3C/g, '<')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\u2028/g, '\u2028')
    .replace(/\\u2029/g, '\u2029');
}
