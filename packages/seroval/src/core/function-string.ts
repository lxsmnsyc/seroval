export default function createFunction(parameters: string[], body: string): string {
  return (
    (parameters.length === 1 ? parameters[0] : '(' + parameters.join(',') + ')') +
    '=>' +
    (body.startsWith('{') ? '(' + body + ')' : body)
  );
}
