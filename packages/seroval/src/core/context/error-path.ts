// oxlint-disable import/prefer-default-export -- named exports, like the other helpers of core.
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/**
 * Formats the path of a parse error for the development message, such as
 * `$.users[3].avatar`. A number is an index, so a key like `'3'` stays quoted.
 * No production message uses it.
 */
export function formatErrorPath(path: readonly (string | number)[]): string {
  let result = '$';
  for (const segment of path) {
    if (typeof segment === 'number') {
      result += '[' + segment + ']';
    } else if (IDENTIFIER.test(segment)) {
      result += '.' + segment;
    } else {
      result += '[' + JSON.stringify(segment) + ']';
    }
  }
  return result;
}
