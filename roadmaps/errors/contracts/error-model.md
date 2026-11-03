---
name: error-model
version: 1
status: draft
defined_by: errors-contract
---

# Contract: error-model

## Purpose

The shape of every seroval error, and the catalog that maps codes to messages and docs. Used by every node in this roadmap and later by `@seroval/rpc`.

## Interface

Draft. errors-contract writes the final version to `packages/seroval/src/core/error-catalog.ts` and `packages/seroval/src/core/errors.ts`.

```ts
type SerovalErrorStep = 'parse' | 'serialize' | 'deserialize';

interface CatalogEntry {
  code: string;            // 'SRV' plus three digits, e.g. 'SRV008' (Q1)
  name: string;            // class name, e.g. 'SerovalMalformedNodeError'
  title: string;           // one line for the docs page
  message(details: Record<string, unknown>): string; // development message, stripped in production
}

class SerovalError extends Error {
  readonly code: string;
  readonly step?: SerovalErrorStep;
  // Specific fields where they apply:
  readonly path?: (string | number)[];
  readonly nodeType?: number;
  readonly nodeId?: number;
  readonly tag?: string;
  readonly limit?: number;
  readonly detail?: string;
  constructor(code: string, details: Record<string, unknown>, options?: { cause?: unknown });
}

// Existing classes become subclasses with the same constructor arguments:
class SerovalMalformedNodeError extends SerovalError { constructor(node: SerovalNode, detail?: string) }
// ...one per existing class.

// The step wrappers keep their classes. A wrapper takes the code of the error it wraps,
// so the outer error says what went wrong, not only in which step.
class SerovalParserError extends SerovalError { constructor(cause: unknown) }
```

Production message:

```
Seroval SRV008 (deserialize): https://seroval.vercel.app/docs/errors/SRV008
```

## Behavior

- `name` equals the class name.
- Every exported constructor keeps its current arguments, including `SerovalError(type, cause)`. The new base takes its code from a protected setup, not from a changed public constructor.
- Public fields stay: `value` on `SerovalUnsupportedTypeError` and `SerovalMissingReferenceError`, `reason: LiveStreamErrorReason` on `SerovalLiveStreamError`. The new detail field is named `detail`, not `reason`, to avoid that clash.
- Errors caused by the data are seroval errors. Errors caused by how the API is called stay standard JavaScript errors (`RangeError`, `TypeError`) with a `code` property from the catalog (Q5). `ArrayBuffer exceeds maxBase64Length` (`deserializer.ts:418`) becomes a seroval limit error with `limit`; the option check at `deserializer.ts:117` stays a `RangeError`.
- `step` is set by the step wrappers (`SerovalParserError`, `SerovalSerializationError`, `SerovalDeserializationError`) and copied onto a seroval error they wrap. Errors that are never wrapped (`SerovalLiveStreamError`, `SerovalAbortedError`) have no step, and their production message drops the parenthesis: `Seroval SRV011: <url>`.
- The catalog has one generic code per step for wrappers around non-seroval errors.
- Each code has a typed details interface (`CatalogDetails` keyed by code), so the throw sites and the messages agree on keys.
- `SerovalMalformedNodeError(node, detail?)`: `node` is whatever the throw site passes today, which can be a sub-field such as a key or `node.f`. `nodeId` and `nodeType` are set only when it is a node.
- The plugin error helper: `createSerovalPluginError(tag: string, expected: string): SerovalError`, with its own code.
- `cause` uses the ES2022 `{ cause }` option. The public `cause` field stays readable.
- A wrapper around a non-seroval error uses a generic code for its step.
- Codes are append-only. errors-contract assigns every code this roadmap needs, including plugin codes, so no later node reserves one.

## Stub

errors-contract freezes `packages/seroval/src/core/error-catalog.ts` with every code, title and details type, and a typed skeleton of the base class in this file. Wave 2 builds against that, not against the draft above.

## Contract tests

`packages/seroval/test/errors/model.test.ts`.

## Changes

- v1: initial draft, with the rules added after the adversarial review (`reviews/adversarial.md`).
