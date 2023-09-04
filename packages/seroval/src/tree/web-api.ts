import assert from '../assert';
import { Feature } from '../compat';
import type { ParserContext } from './context';
import { serializeString } from '../string';
import UnsupportedTypeError from './UnsupportedTypeError';
import { serializeArrayBuffer } from './primitives';
import type {
  SerovalBlobNode,
  SerovalFileNode,
  SerovalURLNode,
  SerovalURLSearchParamsNode,
} from './types';
import {
  SerovalNodeType,
} from './types';

export function createURLNode(
  ctx: ParserContext,
  id: number,
  current: URL,
): SerovalURLNode {
  assert(ctx.features & Feature.WebAPI, new UnsupportedTypeError(current));
  return {
    t: SerovalNodeType.URL,
    i: id,
    s: serializeString(current.href),
    l: undefined,
    c: undefined,
    m: undefined,
    d: undefined,
    f: undefined,
    a: undefined,
    b: undefined,
    o: undefined,
  };
}

export function createURLSearchParamsNode(
  ctx: ParserContext,
  id: number,
  current: URLSearchParams,
): SerovalURLSearchParamsNode {
  assert(ctx.features & Feature.WebAPI, new UnsupportedTypeError(current));
  return {
    t: SerovalNodeType.URLSearchParams,
    i: id,
    s: serializeString(current.toString()),
    l: undefined,
    c: undefined,
    m: undefined,
    d: undefined,
    f: undefined,
    a: undefined,
    b: undefined,
    o: undefined,
  };
}

export async function createBlobNode(
  ctx: ParserContext,
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
    d: undefined,
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
  assert(ctx.features & Feature.WebAPI, new UnsupportedTypeError(current));
  return {
    t: SerovalNodeType.File,
    i: id,
    s: undefined,
    l: undefined,
    c: serializeString(current.type),
    m: serializeString(current.name),
    d: undefined,
    f: serializeArrayBuffer(ctx, await current.arrayBuffer()),
    a: undefined,
    b: current.lastModified,
    o: undefined,
  };
}
