---
title: Errors
description: The errors seroval throws, what causes them, and how to read them in production.
---

## How errors are wrapped

Each function wraps any error it meets in one of three errors, by the step that failed. The original error is in the `cause` property.

| Error | Thrown by |
| --- | --- |
| `SerovalParserError` | Every serialize function, when it cannot read the value. |
| `SerovalSerializationError` | Every function that produces JavaScript, when it cannot write the output. |
| `SerovalDeserializationError` | `fromJSON`, `fromCrossJSON` and `createCrossDeserializer`, when the input is invalid. |

[Binary mode](./binary-mode.md) does not wrap errors. `binary.serialize` and `binary.deserialize` pass the error itself to `onError`, and `binary.deserialize` rejects with it.

```js
import {
  SerovalParserError,
  SerovalUnsupportedTypeError,
  serialize,
} from 'seroval';

try {
  serialize({ callback: () => {} });
} catch (error) {
  error instanceof SerovalParserError; // true
  error.cause instanceof SerovalUnsupportedTypeError; // true
  error.cause.value; // the function
}
```

## Specific errors

These usually arrive as the `cause` of a wrapper error.

| Error | Code | Cause |
| --- | --- | --- |
| `SerovalUnsupportedTypeError` | 1 | The value has a type seroval does not support, such as a function or a class instance with no plugin. The value is in `value`. |
| `SerovalUnsupportedNodeError` | 2 | The input has an unknown node type, or one that uses a disabled feature. |
| `SerovalMissingPluginError` | 3 | No plugin has the tag the input asks for. |
| `SerovalMissingInstanceError` | 4 | The input settles a promise or stream that does not exist. |
| `SerovalMissingReferenceError` | 5 | Deprecated. Not thrown by seroval. |
| `SerovalMissingReferenceForIdError` | 6 | The input refers to a [`createReference`](./isomorphic-references.md) key that is not registered. |
| `SerovalUnknownTypedArrayError` | 7 | The input names an unknown typed array. |
| `SerovalMalformedNodeError` | 8 | A node in the input is malformed. |
| `SerovalConflictedNodeIdError` | 9 | The input declares the same value twice. |
| `SerovalDepthLimitError` | 10 | The value or input is nested deeper than `depthLimit`. |
| `SerovalAbortedError` | 11 | `deserialize` was called on a [cross deserializer](./streaming.md#receiving-a-json-stream) after `abort`. |
| `SerovalLiveStreamError` | 12 | A [live stream](./streams-and-iterables.md#live-streams) was misused. `reason` is `'consumed'`, `'pending'`, `'reading'` or `'closed'`. |

## Binary mode errors

`binary.deserialize` reports these when its input is invalid. See [Untrusted input](./binary-mode.md#untrusted-input) and the [validation rules](./binary-format.md#validation).

| Error | Code | Cause |
| --- | --- | --- |
| `SerovalMalformedBinarySourceError` | 13 | The input ended too early: in the middle of a node, before the `Root` node, or before every container, promise and stream was complete. |
| `SerovalMalformedBinaryTypeError` | 14 | A node is invalid. For example, it declares an id twice, refers to an id that was not declared, has an unknown constant or constructor byte, settles a promise twice, sends a stream event after the stream ended, assigns to a container after its `Pending` node, describes a view outside its buffer, goes over a size limit, or uses a disabled feature. |
| `SerovalUnknownBinaryTypeError` | 15 | A node has an unknown type byte. |
| `SerovalUnexpectedBinaryTypeError` | 16 | A node refers to a value of the wrong node type, for example a `BigInt` whose digits are not a `String`. |
| `SerovalMissingBinaryRefError` | 17 | A node refers to an id that has no value, for example a value from an earlier payload decoded with a different [reference map](./binary-mode.md#sharing-references-between-payloads). |

Binary mode also uses errors from the table above:

- `binary.serialize` reports `SerovalUnsupportedTypeError` and `SerovalDepthLimitError`.
- `binary.deserialize` reports `SerovalMissingPluginError` and `SerovalMissingReferenceForIdError`.

## Messages in production

The production build of seroval replaces messages with codes, to stay small:

- A wrapper error reads `Seroval Error (step: N)`, where 1 is parsing, 2 is serialization and 3 is deserialization.
- A specific error reads `Seroval Error (specific: N)`, with the code from the table above.

The development build has full messages. Bundlers select it through the `development` export condition, which most of them set in development mode. The error classes are the same in both builds, so `instanceof` checks work everywhere.
