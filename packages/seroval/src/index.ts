/* eslint-disable no-await-in-loop */
import { isPrimitive } from './checks';
import { Feature } from './compat';
import {
  createParserContext,
  createSerializationContext,
  getRefParam,
  Options,
  parseAsync,
  parseSync,
  resolvePatches,
  SerializationContext,
  serializePrimitive,
  serializeTree,
  SerovalNode,
} from './tree';
import {
  AsyncServerValue,
  PrimitiveValue,
  ServerValue,
  CommonServerValue,
  SemiPrimitiveValue,
  ErrorValue,
} from './types';

export {
  AsyncServerValue,
  ServerValue,
  PrimitiveValue,
  CommonServerValue,
  SemiPrimitiveValue,
  ErrorValue,
};

function finalize(
  ctx: SerializationContext,
  rootID: number,
  isObject: boolean,
  result: string,
) {
  // Shared references detected
  if (ctx.vars.length) {
    const patches = resolvePatches(ctx);
    let body = result;
    if (patches) {
      // Get (or create) a ref from the source
      const index = getRefParam(ctx, rootID);
      if (result.startsWith(`${index}=`)) {
        body = `${result},${patches}${index}`;
      } else {
        body = `${index}=${result},${patches}${index}`;
      }
    }
    let params = ctx.vars.length > 1
      ? ctx.vars.join(',')
      : ctx.vars[0];
    // Source is probably already assigned
    if (ctx.features & Feature.ArrowFunction) {
      params = ctx.vars.length > 1 || ctx.vars.length === 0
        ? `(${params})`
        : params;
      return `(${params}=>(${body}))()`;
    }
    return `(function(${params}){return ${body}})()`;
  }
  if (isObject) {
    return `(${result})`;
  }
  return result;
}

export function serialize<T extends ServerValue>(
  source: T,
  options?: Partial<Options>,
) {
  const ctx = createParserContext(options);
  if (isPrimitive(source)) {
    return String(serializePrimitive(source));
  }
  const [tree, rootID, isObject] = parseSync(ctx, source);
  const serial = createSerializationContext(ctx);
  const result = serializeTree(serial, tree);
  return finalize(serial, rootID, isObject, result);
}

export async function serializeAsync<T extends AsyncServerValue>(
  source: T,
  options?: Partial<Options>,
) {
  const ctx = createParserContext(options);
  if (isPrimitive(source)) {
    return String(serializePrimitive(source));
  }
  const [tree, rootID, isObject] = await parseAsync(ctx, source);
  const serial = createSerializationContext(ctx);
  const result = serializeTree(serial, tree);
  return finalize(serial, rootID, isObject, result);
}

export function deserialize<T extends AsyncServerValue>(source: string): T {
  // eslint-disable-next-line no-eval
  return (0, eval)(source) as T;
}

type SerovalJSON = [
  tree: SerovalNode,
  root: number,
  isObject: boolean,
  feature: number,
  markedRefs: number[],
];

export function toJSON<T extends ServerValue>(
  source: T,
  options?: Partial<Options>,
) {
  const ctx = createParserContext(options);
  const [tree, root, isObject] = parseSync(ctx, source);
  return JSON.stringify([
    tree,
    root,
    isObject,
    ctx.features,
    [...ctx.markedRefs],
  ]);
}

export async function toJSONAsync<T extends AsyncServerValue>(
  source: T,
  options?: Partial<Options>,
) {
  const ctx = createParserContext(options);
  const [tree, root, isObject] = await parseAsync(ctx, source);
  return JSON.stringify([
    tree,
    root,
    isObject,
    ctx.features,
    [...ctx.markedRefs],
  ]);
}

export function compileJSON(source: string): string {
  const parsed = JSON.parse(source) as SerovalJSON;
  const serial = createSerializationContext({
    features: parsed[3],
    markedRefs: parsed[4],
  });
  const result = serializeTree(serial, parsed[0]);
  return finalize(serial, parsed[1], parsed[2], result);
}

export function fromJSON<T extends AsyncServerValue>(source: string): T {
  return deserialize<T>(compileJSON(source));
}

export default serialize;
