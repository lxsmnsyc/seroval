---
title: Errors
description: The errors seroval throws, their codes, and how to read them in production.
type: reference
---

Every error that seroval throws because of the data is a `SerovalError`. Each one has a `code` such as `SRV008`, and each code has a page that says what it means and how to fix it.

## Fields

| Field | Description |
| --- | --- |
| `name` | The class name, such as `SerovalMalformedNodeError`. |
| `code` | The code from the [table below](#codes). Codes never change once released. |
| `step` | `'parse'`, `'serialize'` or `'deserialize'`. Errors that are never wrapped have none. |
| `path` | Where in the value a parse error happened, as keys and indexes from the root, such as `['users', 0, 'avatar']`. Only parse errors have it. See [Where it failed](#where-it-failed). |
| `cause` | The error that a wrapper caught. |

Some errors add fields with more detail, such as `tag`, `limit`, `nodeType`, `nodeId` or `detail`. The page of each code lists them.

## How errors are wrapped

Each function wraps any error it meets in one of three errors, by the step that failed. The original error is in the `cause` property.

| Error | Step | Thrown by |
| --- | --- | --- |
| `SerovalParserError` | `parse` | Every serialize function, when it cannot read the value. |
| `SerovalSerializationError` | `serialize` | Every function that produces code, when it cannot write the output. |
| `SerovalDeserializationError` | `deserialize` | `fromJSON`, `fromCrossJSON` and `createCrossDeserializer`, when the input is invalid. |

A wrapper takes the code of the seroval error it wraps, so `code` says what went wrong. A wrapper around any other error has the generic code of its step: [SRV014](./errors/SRV014.md), [SRV015](./errors/SRV015.md) or [SRV016](./errors/SRV016.md).

```js
import {
  SerovalError,
  SerovalParserError,
  SerovalUnsupportedTypeError,
  serialize,
} from 'seroval';

try {
  serialize({ callback: () => {} });
} catch (error) {
  error instanceof SerovalError; // true
  error instanceof SerovalParserError; // true
  error.code; // 'SRV001'
  error.step; // 'parse'
  error.cause instanceof SerovalUnsupportedTypeError; // true
  error.cause.value; // the function
}
```

Errors caused by how a function is called, not by the data, are standard errors such as `RangeError`. They still have a `code`.

## Where it failed

When the serializer cannot read a value, the error has a `path` from the root of the value to the part that failed. The wrapper and the error it wraps have the same `path`. In the development build, the message ends with the path:

```js
import { serialize } from 'seroval';

try {
  serialize({ users: [{ name: 'Ada', avatar: () => {} }] });
} catch (error) {
  error.code; // 'SRV001'
  error.path; // ['users', 0, 'avatar']
  error.message;
  // The value [object Function] of type "function" cannot be parsed/serialized.
  // ...
  // At $.users[0].avatar
}
```

A number in `path` is an array index, and a string is a property key. The production message leaves the path out, because it may contain keys from the data. Read `error.path` instead.

## Messages in production

In the production build, each message is one line with the code, the step and the link to the page of the code:

```text
Seroval SRV008 (deserialize): https://seroval.vercel.app/docs/errors/SRV008
```

An error with no step leaves out the parenthesis:

```text
Seroval SRV011: https://seroval.vercel.app/docs/errors/SRV011
```

Production messages never contain values or keys from the data. The development build has full messages that say what was wrong. Bundlers select it through the `development` export condition, which most of them set in development mode. The error classes and fields are the same in both builds, so `instanceof` and `code` checks work everywhere.

## Reading the catalog

`seroval` exports the catalog that these messages come from, for tools that show or log errors:

| Export | Description |
| --- | --- |
| `ERROR_CODES` | Every code by its short name, such as `ERROR_CODES.MalformedNode`, which is `'SRV008'`. |
| `DOCS_ERRORS_URL` | The base URL of the code pages. The page of a code is `` `${DOCS_ERRORS_URL}/${code}` ``. |
| `getProdMessage(code, step?)` | The production message of a code. |
| `getCatalogEntry(code)` | The class name, title and message function of a code. Returns `undefined` in the production build. |
| `getDevMessage(code, details)` | The development message of a code. Returns `''` in the production build. |

The types `ErrorCode`, `ErrorName`, `SerovalErrorStep`, `CatalogEntry` and `SerovalErrorShape` describe the same values.

## Codes

| Code | Error | Meaning |
| --- | --- | --- |
| [SRV001](./errors/SRV001.md) | `SerovalUnsupportedTypeError` | A value cannot be serialized. |
| [SRV002](./errors/SRV002.md) | `SerovalUnsupportedNodeError` | A node has a type that is not supported. |
| [SRV003](./errors/SRV003.md) | `SerovalMissingPluginError` | A plugin for a tag is missing. |
| [SRV004](./errors/SRV004.md) | `SerovalMissingInstanceError` | A required instance is missing. |
| [SRV005](./errors/SRV005.md) | `SerovalMissingReferenceError` | A reference is missing (deprecated). |
| [SRV006](./errors/SRV006.md) | `SerovalMissingReferenceForIdError` | A reference id is missing. |
| [SRV007](./errors/SRV007.md) | `SerovalUnknownTypedArrayError` | A typed array name is unknown. |
| [SRV008](./errors/SRV008.md) | `SerovalMalformedNodeError` | A node has the wrong shape. |
| [SRV009](./errors/SRV009.md) | `SerovalConflictedNodeIdError` | Two nodes have the same id. |
| [SRV010](./errors/SRV010.md) | `SerovalDepthLimitError` | The depth limit was reached. |
| [SRV011](./errors/SRV011.md) | `SerovalAbortedError` | The cross deserializer was aborted. |
| [SRV012](./errors/SRV012.md) | `SerovalLiveStreamError` | A live stream was used in a wrong state. |
| [SRV013](./errors/SRV013.md) | `SerovalPluginValidationError` | A plugin value failed its validator. |
| [SRV014](./errors/SRV014.md) | `SerovalParserError` | The parser failed with an error that is not from seroval. |
| [SRV015](./errors/SRV015.md) | `SerovalSerializationError` | The serializer failed with an error that is not from seroval. |
| [SRV016](./errors/SRV016.md) | `SerovalDeserializationError` | The deserializer failed with an error that is not from seroval. |
| [SRV017](./errors/SRV017.md) | `SerovalStreamConsumedError` | A stream already has a consumer. |
| [SRV018](./errors/SRV018.md) | `SerovalStreamOutputError` | The stream parser has no output callback. |
| [SRV019](./errors/SRV019.md) | `RangeError` | The maxBase64Length option is invalid. |
| [SRV020](./errors/SRV020.md) | `SerovalBase64LimitError` | An ArrayBuffer is larger than maxBase64Length. |

## Related

- [Upgrade to 1.9](./migration/1-9.md)
- [Security](./security.md)
- [API reference](./api.md#errors)
