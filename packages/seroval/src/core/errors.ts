import { serializeString } from './string';
import type { SerovalNode } from './types';

const { toString: objectToString } = /* @__PURE__ */ Object.prototype;

function getErrorMessage(type: string, cause: any): string {
  if (cause instanceof Error) {
    return `Seroval caught an error during the ${type} process.
  
${cause.name}
${cause.message}

- For more information, please check the "cause" property of this error.
- If you believe this is an error in Seroval, please submit an issue at https://github.com/lxsmnsyc/seroval/issues/new`;
  }
  return `Seroval caught an error during the ${type} process.

"${objectToString.call(cause)}"

For more information, please check the "cause" property of this error.`;
}

export class SerovalError extends Error {
  constructor(
    type: string,
    public cause: any,
  ) {
    super(getErrorMessage(type, cause));
  }
}

export class SerovalParserError extends SerovalError {
  constructor(cause: any) {
    super('parsing', cause);
  }
}

export class SerovalSerializationError extends SerovalError {
  constructor(cause: any) {
    super('serialization', cause);
  }
}

export class SerovalDeserializationError extends SerovalError {
  constructor(cause: any) {
    super('deserialization', cause);
  }
}

export class SerovalUnsupportedTypeError extends Error {
  constructor(public value: unknown) {
    super(
      `The value ${objectToString.call(value)} of type "${typeof value}" cannot be parsed/serialized.
      
There are few workarounds for this problem:
- Transform the value in a way that it can be serialized.
- If the reference is present on multiple runtimes (isomorphic), you can use the Reference API to map the references.`,
    );
  }
}

export class SerovalUnsupportedNodeError extends Error {
  constructor(node: SerovalNode) {
    super('Unsupported node type "' + node.t + '".');
  }
}

export class SerovalMissingPluginError extends Error {
  constructor(tag: string) {
    super('Missing plugin for tag "' + tag + '".');
  }
}

export class SerovalMissingInstanceError extends Error {
  constructor(tag: string) {
    super('Missing "' + tag + '" instance.');
  }
}

export class SerovalMissingReferenceError extends Error {
  constructor(public value: unknown) {
    super(
      'Missing reference for the value "' +
        objectToString.call(value) +
        '" of type "' +
        typeof value +
        '"',
    );
  }
}

export class SerovalMissingReferenceForIdError extends Error {
  constructor(id: string) {
    super('Missing reference for id "' + serializeString(id) + '"');
  }
}

export class SerovalUnknownTypedArrayError extends Error {
  constructor(name: string) {
    super('Unknown TypedArray "' + name + '"');
  }
}
