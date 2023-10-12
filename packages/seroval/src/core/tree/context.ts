export interface DeserializerContext {
  values: Map<number, unknown>;
  refs: Set<number>;
}

export interface DeserializerOptions {
  markedRefs: number[] | Set<number>;
}

export function createDeserializerContext(
  options: DeserializerOptions,
): DeserializerContext {
  return {
    values: new Map(),
    refs: new Set(options.markedRefs),
  };
}
