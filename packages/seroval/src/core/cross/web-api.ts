import assert from '../assert';
import { Feature } from '../compat';
import type { CrossParserContext } from './context';
import { serializeString } from '../string';
import UnsupportedTypeError from '../UnsupportedTypeError';
import { serializeArrayBuffer } from './primitives';
import type {
  SerovalBlobNode,
  SerovalFileNode,
} from '../types';
import { SerovalNodeType } from '../constants';

export async function createBlobNode(
  ctx: CrossParserContext,
  id: number,
  current: Blob,
): Promise<SerovalBlobNode> {
  assert(ctx.features & Feature.WebAPI, new UnsupportedTypeError(current));
  return {
    t: SerovalNodeType.Blob,
    i: id,
    s: undefined,
    l: undefined,
    c: serializeString(current.type),
    m: undefined,
    p: undefined,
    e: undefined,
    f: serializeArrayBuffer(ctx, await current.arrayBuffer()),
    a: undefined,
    b: undefined,
    o: undefined,
  };
}

export async function createFileNode(
  ctx: CrossParserContext,
  id: number,
  current: File,
): Promise<SerovalFileNode> {
  assert(ctx.features & Feature.WebAPI, new UnsupportedTypeError(current));
  return {
    t: SerovalNodeType.File,
    i: id,
    s: undefined,
    l: undefined,
    c: serializeString(current.type),
    m: serializeString(current.name),
    p: undefined,
    e: undefined,
    f: serializeArrayBuffer(ctx, await current.arrayBuffer()),
    a: undefined,
    b: current.lastModified,
    o: undefined,
  };
}
