export function isValidIdentifier(name: string): boolean {
  const len = name.length;
  for (let i = 0; i < len; i++) {
    const code = name.charCodeAt(i);
    if (
      !(
        (code >= 97 && code <= 122) ||
        (code >= 65 && code <= 90) ||
        (code >= 48 && code <= 57 && i > 0) ||
        code === 95 ||
        code === 36
      )
    ) {
      return false;
    }
  }
  return len > 0;
}
