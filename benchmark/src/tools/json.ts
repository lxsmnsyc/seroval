const ESCAPED_CHARS = /[<\u2028\u2029]/g;

export const name = 'JSON';

function replacer(m: string): string {
  switch (m) {
    case '<':
      return '\\x3C';
    case '\u2028':
      return '\\u2028';
    case '\u2029':
      return '\\u2029';
    default:
      return '';
  }
}

// This is testing using JSON.stringify output injected into a <script>
// To be fair to the benchmark it needs to be escaped properly for the script.
export function toString(data: unknown): string {
  return JSON.stringify(data).replace(ESCAPED_CHARS, replacer);
}

export function fromString(str: string): unknown {
  // oxlint-disable-next-line no-eval -- This reads the output as script source, like toString prepares it.
  return (0, eval)(str);
}
