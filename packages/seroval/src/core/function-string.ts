import { Feature } from './compat';

export function createFunction(
  features: number,
  parameters: string[],
  body: string,
): string {
  if (features & Feature.ArrowFunction) {
    const joined =
      parameters.length === 1
        ? parameters[0]
        : '(' + parameters.join(',') + ')';
    return joined + '=>' + (body.startsWith('{') ? '(' + body + ')' : body);
  }
  return 'function(' + parameters.join(',') + '){return ' + body + '}';
}

export function createEffectfulFunction(
  features: number,
  parameters: string[],
  body: string,
): string {
  if (features & Feature.ArrowFunction) {
    const joined =
      parameters.length === 1
        ? parameters[0]
        : '(' + parameters.join(',') + ')';
    return joined + '=>{' + body + '}';
  }
  return 'function(' + parameters.join(',') + '){' + body + '}';
}
