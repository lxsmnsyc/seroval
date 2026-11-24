/// <reference types="tsdown" />

import type {
  CatalogDetails,
  ErrorCode,
  LiveStreamErrorReason,
  SerovalErrorStep,
} from './error-catalog';
import { formatErrorPath } from './context/error-path';
import { ERROR_CODES, getDevMessage, getProdMessage } from './error-catalog';
import type { SerovalNode } from './types';

export type { LiveStreamErrorReason } from './error-catalog';

interface ErrorFields {
  path?: (string | number)[];
  nodeType?: number;
  nodeId?: number;
  tag?: string;
  limit?: number;
  detail?: string;
}

interface ErrorInit extends ErrorFields {
  code: ErrorCode;
  step?: SerovalErrorStep;
  details: unknown;
  // Development message for a generic error with an unknown step.
  message?: string;
}

const STEPS: Partial<Record<string, SerovalErrorStep>> = {
  parsing: 'parse',
  serialization: 'serialize',
  deserialization: 'deserialize',
};

const STEP_CODES: Record<SerovalErrorStep, ErrorCode> = {
  parse: ERROR_CODES.ParseFailure,
  serialize: ERROR_CODES.SerializeFailure,
  deserialize: ERROR_CODES.DeserializeFailure,
};

function getMessage(init: ErrorInit): string {
  if (import.meta.env.PROD) {
    return getProdMessage(init.code, init.step);
  }
  if (init.message) {
    return init.message;
  }
  // The details were built for this code by `createInit` or `resolveStepInit`.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the details match their code.
  return getDevMessage(init.code, init.details as CatalogDetails[ErrorCode]);
}

/**
 * The message of a wrapped error without its `At <path>` line. The wrapper
 * adds its own, so the message ends with one.
 */
function stripPathSuffix(error: SerovalError): string {
  if (Array.isArray(error.path)) {
    const suffix = '\n\nAt ' + formatErrorPath(error.path);
    if (error.message.endsWith(suffix)) {
      return error.message.slice(0, error.message.length - suffix.length);
    }
  }
  return error.message;
}

function resolveStepInit(type: string, cause: unknown): ErrorInit {
  const step = STEPS[type];
  if (!step) {
    // An unknown step type gets the generic parse code (SRV014) and no step.
    return {
      code: STEP_CODES.parse,
      details: { cause },
      message: 'Seroval caught an error during the ' + type + ' process.',
    };
  }
  // oxlint-disable-next-line eslint/no-use-before-define -- the class and this function refer to each other.
  if (cause instanceof SerovalError) {
    // Same code as the wrapped error, so the outer error says what went wrong.
    // The development message is the one of the wrapped error.
    return {
      code: cause.code,
      step,
      details: { cause },
      message: stripPathSuffix(cause),
      // A path that is not an array is not ours to read; the wrapper owns its copy.
      path: Array.isArray(cause.path) ? cause.path.slice() : undefined,
      nodeType: cause.nodeType,
      nodeId: cause.nodeId,
      tag: cause.tag,
      limit: cause.limit,
      detail: cause.detail,
    };
  }
  return { code: STEP_CODES[step], step, details: { cause } };
}

function createInit<C extends ErrorCode>(
  code: C,
  details: CatalogDetails[C],
  fields?: ErrorFields,
): ErrorInit {
  return { code, details, ...fields };
}

function isNode(value: unknown): value is SerovalNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- only reads `t`.
    typeof (value as SerovalNode).t === 'number'
  );
}

export class SerovalError extends Error {
  declare cause: unknown;
  declare code: ErrorCode;
  declare step?: SerovalErrorStep;
  declare path?: (string | number)[];
  declare nodeType?: number;
  declare nodeId?: number;
  declare tag?: string;
  declare limit?: number;
  declare detail?: string;

  /**
   * `type` is the step that failed (`parsing`, `serialization` or
   * `deserialization`) and `cause` is the error it wraps. A wrapper takes the
   * code of a wrapped seroval error. Subclasses pass `init` instead.
   */
  constructor(type: string, cause: unknown, init?: ErrorInit) {
    const resolved = init ?? resolveStepInit(type, cause);
    super(getMessage(resolved), { cause });
    this.name = 'SerovalError';
    this.cause = cause;
    this.code = resolved.code;
    if (resolved.step) {
      this.step = resolved.step;
    }
    if (resolved.path) {
      this.path = resolved.path;
      if (!import.meta.env.PROD) {
        this.message += '\n\nAt ' + formatErrorPath(resolved.path);
      }
    }
    if (resolved.nodeType !== undefined) {
      this.nodeType = resolved.nodeType;
    }
    if (resolved.nodeId !== undefined) {
      this.nodeId = resolved.nodeId;
    }
    if (resolved.tag !== undefined) {
      this.tag = resolved.tag;
    }
    if (resolved.limit !== undefined) {
      this.limit = resolved.limit;
    }
    if (resolved.detail !== undefined) {
      this.detail = resolved.detail;
    }
    // The wrapped error learns the step it failed in.
    if (
      !init &&
      cause instanceof SerovalError &&
      cause.step === undefined &&
      Object.isExtensible(cause)
    ) {
      cause.step = resolved.step;
    }
  }
}

export class SerovalParserError extends SerovalError {
  constructor(cause: unknown) {
    super('parsing', cause);
    this.name = 'SerovalParserError';
  }
}

export class SerovalSerializationError extends SerovalError {
  constructor(cause: unknown) {
    super('serialization', cause);
    this.name = 'SerovalSerializationError';
  }
}

export class SerovalDeserializationError extends SerovalError {
  constructor(cause: unknown) {
    super('deserialization', cause);
    this.name = 'SerovalDeserializationError';
  }
}

export class SerovalUnsupportedTypeError extends SerovalError {
  constructor(public value: unknown) {
    super('', undefined, createInit(ERROR_CODES.UnsupportedType, { value }));
    this.name = 'SerovalUnsupportedTypeError';
  }
}

export class SerovalUnsupportedNodeError extends SerovalError {
  constructor(node: SerovalNode, detail?: string) {
    const fields: ErrorFields = { nodeType: node.t, detail };
    if (typeof node.i === 'number') {
      fields.nodeId = node.i;
    }
    super(
      '',
      undefined,
      createInit(
        ERROR_CODES.UnsupportedNode,
        { nodeType: node.t, nodeId: fields.nodeId, detail },
        fields,
      ),
    );
    this.name = 'SerovalUnsupportedNodeError';
  }
}

export class SerovalMissingPluginError extends SerovalError {
  constructor(tag: string) {
    super('', undefined, createInit(ERROR_CODES.MissingPlugin, { tag }, { tag }));
    this.name = 'SerovalMissingPluginError';
  }
}

export class SerovalPluginValidationError extends SerovalError {
  constructor(
    tag: string,
    public field: string,
  ) {
    super('', undefined, createInit(ERROR_CODES.PluginValidation, { tag, field }, { tag }));
    this.name = 'SerovalPluginValidationError';
  }
}

export class SerovalMissingInstanceError extends SerovalError {
  constructor(tag: string) {
    super('', undefined, createInit(ERROR_CODES.MissingInstance, { tag }, { tag }));
    this.name = 'SerovalMissingInstanceError';
  }
}

/**
 * @deprecated Not thrown by seroval. A missing `createReference` key throws
 * {@link SerovalMissingReferenceForIdError} instead.
 */
export class SerovalMissingReferenceError extends SerovalError {
  constructor(public value: unknown) {
    super('', undefined, createInit(ERROR_CODES.MissingReference, { value }));
    this.name = 'SerovalMissingReferenceError';
  }
}

export class SerovalMissingReferenceForIdError extends SerovalError {
  constructor(id: string) {
    super('', undefined, createInit(ERROR_CODES.MissingReferenceForId, { id }));
    this.name = 'SerovalMissingReferenceForIdError';
  }
}

export class SerovalUnknownTypedArrayError extends SerovalError {
  constructor(name: string) {
    super('', undefined, createInit(ERROR_CODES.UnknownTypedArray, { name }));
    this.name = 'SerovalUnknownTypedArrayError';
  }
}

export class SerovalMalformedNodeError extends SerovalError {
  /**
   * `node` is what the throw site has at hand. It can be a part of a node, such
   * as a key, so `nodeType` and `nodeId` are set only when it is a node.
   */
  constructor(node: unknown, detail?: string) {
    const fields: ErrorFields = { detail };
    if (isNode(node)) {
      fields.nodeType = node.t;
      if (typeof node.i === 'number') {
        fields.nodeId = node.i;
      }
    }
    super(
      '',
      undefined,
      createInit(
        ERROR_CODES.MalformedNode,
        { nodeType: fields.nodeType, nodeId: fields.nodeId, detail },
        fields,
      ),
    );
    this.name = 'SerovalMalformedNodeError';
  }
}

export class SerovalConflictedNodeIdError extends SerovalError {
  constructor(node: SerovalNode) {
    super(
      '',
      undefined,
      createInit(ERROR_CODES.ConflictedNodeId, { nodeId: node.i }, { nodeId: node.i }),
    );
    this.name = 'SerovalConflictedNodeIdError';
  }
}

export class SerovalDepthLimitError extends SerovalError {
  constructor(limit: number) {
    super('', undefined, createInit(ERROR_CODES.DepthLimit, { limit }, { limit }));
    this.name = 'SerovalDepthLimitError';
  }
}

export class SerovalAbortedError extends SerovalError {
  constructor() {
    super('', undefined, createInit(ERROR_CODES.Aborted, {}));
    this.name = 'SerovalAbortedError';
  }
}

export class SerovalLiveStreamError extends SerovalError {
  constructor(public reason: LiveStreamErrorReason) {
    super('', undefined, createInit(ERROR_CODES.LiveStream, { reason }));
    this.name = 'SerovalLiveStreamError';
  }
}

export class SerovalStreamConsumedError extends SerovalError {
  constructor() {
    super('', undefined, createInit(ERROR_CODES.StreamConsumed, {}));
    this.name = 'SerovalStreamConsumedError';
  }
}

export class SerovalStreamOutputError extends SerovalError {
  constructor() {
    super('', undefined, createInit(ERROR_CODES.StreamOutputUnavailable, {}));
    this.name = 'SerovalStreamOutputError';
  }
}

export class SerovalBase64LimitError extends SerovalError {
  constructor(limit: number) {
    super('', undefined, createInit(ERROR_CODES.Base64LengthLimit, { limit }, { limit }));
    this.name = 'SerovalBase64LimitError';
  }
}
