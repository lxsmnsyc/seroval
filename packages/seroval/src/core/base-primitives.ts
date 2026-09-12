import type { WellKnownSymbols } from './constants';
import {
  INV_SYMBOL_REF,
  NIL,
  SerovalNodeType,
  type SerovalTemporalType,
} from './constants';
import {
  INFINITY_NODE,
  NAN_NODE,
  NEG_INFINITY_NODE,
  NEG_ZERO_NODE,
} from './literals';
import { createSerovalNode } from './node';
import { serializeString } from './string';
import type {
  SerovalAggregateErrorNode,
  SerovalArrayNode,
  SerovalAsyncIteratorFactoryInstanceNode,
  SerovalBigIntNode,
  SerovalBigIntTypedArrayNode,
  SerovalBoxedNode,
  SerovalConstantNode,
  SerovalDataViewNode,
  SerovalDateNode,
  SerovalErrorNode,
  SerovalIndexedValueNode,
  SerovalIteratorFactoryInstanceNode,
  SerovalNode,
  SerovalNodeWithID,
  SerovalNumberNode,
  SerovalObjectRecordNode,
  SerovalPluginNode,
  SerovalReferenceNode,
  SerovalRegExpNode,
  SerovalSequenceNode,
  SerovalSetNode,
  SerovalStreamConstructorNode,
  SerovalStreamNextNode,
  SerovalStreamReturnNode,
  SerovalStreamThrowNode,
  SerovalStringNode,
  SerovalTemporalNode,
  SerovalTypedArrayNode,
  SerovalWKSymbolNode,
} from './types';
import { getErrorConstructor } from './utils/error';
import { getObjectFlag } from './utils/get-object-flag';
import type {
  BigIntTypedArrayValue,
  TypedArrayValue,
} from './utils/typed-array';

export function createNumberNode(
  value: number,
): SerovalConstantNode | SerovalNumberNode {
  switch (value) {
    case Number.POSITIVE_INFINITY:
      return INFINITY_NODE;
    case Number.NEGATIVE_INFINITY:
      return NEG_INFINITY_NODE;
  }
  if (value !== value) {
    return NAN_NODE;
  }
  if (Object.is(value, -0)) {
    return NEG_ZERO_NODE;
  }
  return createSerovalNode(SerovalNodeType.Number, NIL, value);
}

export function createStringNode(value: string): SerovalStringNode {
  return createSerovalNode(SerovalNodeType.String, NIL, serializeString(value));
}

export function createBigIntNode(current: bigint): SerovalBigIntNode {
  return createSerovalNode(SerovalNodeType.BigInt, NIL, '' + current);
}

export function createIndexedValueNode(id: number): SerovalIndexedValueNode {
  return createSerovalNode(SerovalNodeType.IndexedValue, id);
}

export function createDateNode(id: number, current: Date): SerovalDateNode {
  const timestamp = current.valueOf();
  return createSerovalNode(
    SerovalNodeType.Date,
    id,
    timestamp === timestamp ? current.toISOString() : '',
  );
}

type SerovalTemporalValue =
  | Temporal.Instant
  | Temporal.Duration
  | Temporal.PlainDate
  | Temporal.PlainDateTime
  | Temporal.PlainMonthDay
  | Temporal.PlainTime
  | Temporal.PlainYearMonth
  | Temporal.ZonedDateTime;

export function createTemporalNode(
  id: number,
  type: SerovalTemporalType,
  current: SerovalTemporalValue,
): SerovalTemporalNode {
  return createSerovalNode(
    SerovalNodeType.Temporal,
    id,
    current.toString(),
    type,
  );
}

export function createRegExpNode(
  id: number,
  current: RegExp,
): SerovalRegExpNode {
  return createSerovalNode(
    SerovalNodeType.RegExp,
    id,
    NIL,
    serializeString(current.source),
    current.flags,
  );
}

export function createWKSymbolNode(
  id: number,
  current: WellKnownSymbols,
): SerovalWKSymbolNode {
  return createSerovalNode(
    SerovalNodeType.WKSymbol,
    id,
    INV_SYMBOL_REF[current],
  );
}

export function createReferenceNode(
  id: number,
  referenceId: string,
): SerovalReferenceNode {
  return createSerovalNode(
    SerovalNodeType.Reference,
    id,
    serializeString(referenceId),
  );
}

export function createPluginNode(
  id: number,
  tag: string,
  value: Record<string, SerovalNode>,
): SerovalPluginNode {
  return createSerovalNode(
    SerovalNodeType.Plugin,
    id,
    value,
    serializeString(tag),
  );
}

export function createArrayNode(
  id: number,
  current: unknown[],
  parsedItems: SerovalArrayNode['a'],
): SerovalArrayNode {
  return createSerovalNode(
    SerovalNodeType.Array,
    id,
    NIL,
    NIL,
    NIL,
    NIL,
    NIL,
    parsedItems,
    NIL,
    NIL,
    getObjectFlag(current),
  );
}

export function createBoxedNode(
  id: number,
  boxed: SerovalNode,
): SerovalBoxedNode {
  return createSerovalNode(
    SerovalNodeType.Boxed,
    id,
    NIL,
    NIL,
    NIL,
    NIL,
    NIL,
    NIL,
    boxed,
  );
}

export function createTypedArrayNode(
  type: SerovalNodeType.TypedArray | SerovalNodeType.BigIntTypedArray,
  id: number,
  current: TypedArrayValue | BigIntTypedArrayValue,
  buffer: SerovalNode,
): SerovalTypedArrayNode | SerovalBigIntTypedArrayNode {
  return createSerovalNode(
    type,
    id,
    NIL,
    current.constructor.name,
    NIL,
    NIL,
    NIL,
    NIL,
    buffer,
    current.byteOffset,
    NIL,
    current.length,
  );
}

export function createDataViewNode(
  id: number,
  current: DataView,
  buffer: SerovalNode,
): SerovalDataViewNode {
  return createSerovalNode(
    SerovalNodeType.DataView,
    id,
    NIL,
    NIL,
    NIL,
    NIL,
    NIL,
    NIL,
    buffer,
    current.byteOffset,
    NIL,
    current.byteLength,
  );
}

export function createErrorNode(
  type: SerovalNodeType.Error | SerovalNodeType.AggregateError,
  id: number,
  current: Error,
  options: SerovalObjectRecordNode | undefined,
): SerovalErrorNode | SerovalAggregateErrorNode {
  return createSerovalNode(
    type,
    id,
    getErrorConstructor(current),
    NIL,
    serializeString(current.message),
    options,
  );
}

export function createSetNode(
  id: number,
  items: SerovalNode[],
): SerovalSetNode {
  return createSerovalNode(
    SerovalNodeType.Set,
    id,
    NIL,
    NIL,
    NIL,
    NIL,
    NIL,
    items,
  );
}

export function createIteratorFactoryInstanceNode(
  type:
    | SerovalNodeType.IteratorFactoryInstance
    | SerovalNodeType.AsyncIteratorFactoryInstance,
  factory: SerovalNodeWithID,
  items: SerovalNodeWithID,
):
  | SerovalIteratorFactoryInstanceNode
  | SerovalAsyncIteratorFactoryInstanceNode {
  return createSerovalNode(type, NIL, NIL, NIL, NIL, NIL, NIL, [
    factory,
    items,
  ]);
}

export function createStreamConstructorNode(
  id: number,
  factory: SerovalNodeWithID,
  sequence: SerovalNode[],
): SerovalStreamConstructorNode {
  return createSerovalNode(
    SerovalNodeType.StreamConstructor,
    id,
    NIL,
    NIL,
    NIL,
    NIL,
    NIL,
    sequence,
    factory,
  );
}

export function createStreamNode(
  type:
    | SerovalNodeType.StreamNext
    | SerovalNodeType.StreamThrow
    | SerovalNodeType.StreamReturn,
  id: number,
  parsed: SerovalNode,
): SerovalStreamNextNode | SerovalStreamThrowNode | SerovalStreamReturnNode {
  return createSerovalNode(type, id, NIL, NIL, NIL, NIL, NIL, NIL, parsed);
}

export function createSequenceNode(
  id: number,
  sequence: SerovalNode[],
  throwAt: number,
  doneAt: number,
): SerovalSequenceNode {
  return createSerovalNode(
    SerovalNodeType.Sequence,
    id,
    throwAt,
    NIL,
    NIL,
    NIL,
    NIL,
    sequence,
    NIL,
    NIL,
    NIL,
    doneAt,
  );
}
