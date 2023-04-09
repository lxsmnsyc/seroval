const SAFE_SERIALIZE_CHECK = /<|\u2028|\u2029/;

export function serializeChar(str: string): string {
  switch (str) {
    case '<':
      return '\\x3C';
    case '\u2028':
      return '\\u2028';
    case '\u2029':
      return '\\u2029';
    default:
      return str;
  }
}

export function serializeString(str: string) {
  const safe = JSON.stringify(str);
  const unquoted = safe.substring(1, safe.length - 1);
  if (SAFE_SERIALIZE_CHECK.test(unquoted)) {
    return unquoted.replace(/<|\u2028|\u2029/g, serializeChar);
  }
  return unquoted;
}

export function deserializeString(str: string): string {
  const restored = str.replace(/\\x3C/g, '<')
    .replace(/\\u2028/g, '\u2028')
    .replace(/\\u2029/g, '\u2029');
  return JSON.parse('"' + restored + '"') as string;
}
