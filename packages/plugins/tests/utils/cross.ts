import {
  type CrossSerializeStreamOptions,
  type ToCrossJSONStreamOptions,
  crossSerializeStream,
  fromCrossJSON,
  toCrossJSONStream,
} from 'seroval';

type StreamOptions = Omit<CrossSerializeStreamOptions, 'onSerialize' | 'onDone' | 'onError'>;
type JSONStreamOptions = Omit<ToCrossJSONStreamOptions, 'onParse' | 'onDone' | 'onError'>;

function createScope(scopeId: string | undefined): unknown[] {
  // Scoped output reads `$R[scopeId]`, unscoped output reads `$R` directly
  if (scopeId == null) {
    return [];
  }
  const scope: unknown[] = [];
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- scoped output indexes `$R` by the scope id.
  return { [scopeId]: scope } as unknown as unknown[];
}

function readRoot(refs: unknown[], scopeId: string | undefined): unknown {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see createScope.
  const scope = scopeId == null ? refs : ((refs as unknown as Record<string, unknown[]>)[scopeId] ?? []);
  return scope[0];
}

export function evaluateCross<T>(source: string, scopeId?: string): T {
  // oxlint-disable-next-line eslint/no-new-func, typescript/no-implied-eval, typescript/no-unsafe-call, typescript/no-unsafe-type-assertion -- evaluates the serialized output.
  return new Function('$R', `return (${source})`)(createScope(scopeId)) as T;
}

export async function streamCross<T>(source: unknown, options: StreamOptions = {}): Promise<T> {
  const refs = createScope(options.scopeId);
  await new Promise<void>((resolve, reject) => {
    crossSerializeStream(source, {
      ...options,
      onSerialize(data) {
        // Run each chunk as it arrives, the way a page runs streamed scripts
        // oxlint-disable-next-line eslint/no-new-func, typescript/no-implied-eval, typescript/no-unsafe-call -- evaluates the serialized output.
        new Function('$R', data)(refs);
      },
      onDone: resolve,
      onError: reject,
    });
  });
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the first chunk stores the root value.
  return readRoot(refs, options.scopeId) as T;
}

export async function streamCrossJSON<T>(
  source: unknown,
  options: JSONStreamOptions = {},
): Promise<T> {
  const refs = new Map<number, unknown>();
  let root: unknown;
  await new Promise<void>((resolve, reject) => {
    toCrossJSONStream(source, {
      ...options,
      onParse(node, initial) {
        const value = fromCrossJSON(node, { refs, plugins: options.plugins });
        if (initial) {
          root = value;
        }
      },
      onDone: resolve,
      onError: reject,
    });
  });
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the initial node holds the root value.
  return root as T;
}

export async function drain<T>(source: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of source) {
    items.push(item);
  }
  return items;
}
