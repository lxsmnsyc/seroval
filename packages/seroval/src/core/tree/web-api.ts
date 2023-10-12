import type { ParserContext } from './context';
import { serializeString } from '../string';
import { serializeArrayBuffer } from './primitives';
import type {
  SerovalBlobNode,
  SerovalFileNode,
} from '../types';
import { SerovalNodeType } from '../constants';

export async function createBlobNode(
  ctx: ParserContext,
  id: number,
  current: Blob,
): Promise<SerovalBlobNode> {
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
  ctx: ParserContext,
  id: number,
  current: File,
): Promise<SerovalFileNode> {
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
