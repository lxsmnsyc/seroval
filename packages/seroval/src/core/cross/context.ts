import type { BaseSerializerContext } from '../context';

export interface CrossSerializerContext extends BaseSerializerContext {
}

export interface CrossSerializerOptions {
  features: number;
}

export function createCrossSerializerContext(
  options: CrossSerializerOptions,
): CrossSerializerContext {
  return {
    stack: [],
    assignments: [],
    features: options.features,
    flags: [],
  };
}
