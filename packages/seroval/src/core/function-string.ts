export function createFunction(parameters: string[], body: string): string {
  const joined =
    parameters.length === 1 ? parameters[0] : '(' + parameters.join(',') + ')';
  return joined + '=>' + (body.startsWith('{') ? '(' + body + ')' : body);
}

export function createEffectfulFunction(
  parameters: string[],
  body: string,
): string {
  const joined =
    parameters.length === 1 ? parameters[0] : '(' + parameters.join(',') + ')';
  return joined + '=>{' + body + '}';
}
