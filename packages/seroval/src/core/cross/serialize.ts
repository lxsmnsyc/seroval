import type {
  SerovalPromiseConstructorNode,
  SerovalPromiseResolveNode,
  SerovalPromiseRejectNode,
  SerovalReadableStreamCloseNode,
  SerovalReadableStreamEnqueueNode,
  SerovalReadableStreamErrorNode,
  SerovalReadableStreamConstructorNode,
  SerovalNode,
} from '../types';
import {
  GLOBAL_CONTEXT_PROMISE_REJECT,
  GLOBAL_CONTEXT_PROMISE_RESOLVE,
  GLOBAL_CONTEXT_PROMISE_CONSTRUCTOR,
  GLOBAL_CONTEXT_REFERENCES,
  GLOBAL_CONTEXT_STREAM_CONSTRUCTOR,
  GLOBAL_CONTEXT_STREAM_EMIT,
  GLOBAL_CONTEXT_API,
} from '../keys';
import type { BaseSerializerContextOptions } from '../serializer-context';
import BaseSerializerContext from '../serializer-context';
import type { SerovalMode } from '../plugin';
import { serializeString } from '../string';
import type { CrossContextOptions } from './cross-parser';
import { createFunction } from '../function-string';

export interface CrossSerializerContextOptions
  extends BaseSerializerContextOptions, CrossContextOptions {
}

export default class CrossSerializerContext extends BaseSerializerContext {
  readonly mode: SerovalMode = 'cross';

  scopeId?: string;

  constructor(options: CrossSerializerContextOptions) {
    super(options);
    this.scopeId = options.scopeId;
  }

  getRefParam(id: number | string): string {
    if (typeof id === 'string') {
      return GLOBAL_CONTEXT_REFERENCES + '.' + id;
    }
    return GLOBAL_CONTEXT_REFERENCES + '[' + id + ']';
  }

  protected assignIndexedValue(
    index: number,
    value: string,
  ): string {
    return this.getRefParam(index) + '=' + value;
  }

  protected serializePromiseConstructor(
    node: SerovalPromiseConstructorNode,
  ): string {
    return this.assignIndexedValue(node.i, GLOBAL_CONTEXT_API + '.' + GLOBAL_CONTEXT_PROMISE_CONSTRUCTOR + '()');
  }

  protected serializePromiseResolve(
    node: SerovalPromiseResolveNode,
  ): string {
    return GLOBAL_CONTEXT_API + '.' + GLOBAL_CONTEXT_PROMISE_RESOLVE + '(' + this.getRefParam(node.i) + ',' + this.serialize(node.f) + ')';
  }

  protected serializePromiseReject(
    node: SerovalPromiseRejectNode,
  ): string {
    return GLOBAL_CONTEXT_API + '.' + GLOBAL_CONTEXT_PROMISE_REJECT + '(' + this.getRefParam(node.i) + ',' + this.serialize(node.f) + ')';
  }

  protected serializeReadableStreamConstructor(
    node: SerovalReadableStreamConstructorNode,
  ): string {
    return this.assignIndexedValue(node.i, GLOBAL_CONTEXT_API + '.' + GLOBAL_CONTEXT_STREAM_CONSTRUCTOR + '()');
  }

  protected serializeReadableStreamEnqueue(
    node: SerovalReadableStreamEnqueueNode,
  ): string {
    return GLOBAL_CONTEXT_API + '.' + GLOBAL_CONTEXT_STREAM_EMIT + '(' + this.getRefParam(node.i) + ',0,' + this.serialize(node.f) + ')';
  }

  protected serializeReadableStreamError(
    node: SerovalReadableStreamErrorNode,
  ): string {
    return GLOBAL_CONTEXT_API + '.' + GLOBAL_CONTEXT_STREAM_EMIT + '(' + this.getRefParam(node.i) + ',1,' + this.serialize(node.f) + ')';
  }

  protected serializeReadableStreamClose(
    node: SerovalReadableStreamCloseNode,
  ): string {
    return GLOBAL_CONTEXT_API + '.' + GLOBAL_CONTEXT_STREAM_EMIT + '(' + this.getRefParam(node.i) + ',2)';
  }

  serializeTop(tree: SerovalNode): string {
    const result = this.serialize(tree);
    const id = tree.i;
    if (id == null) {
      return result;
    }
    const patches = this.resolvePatches();
    const ref = this.getRefParam(id);
    const params = this.scopeId == null ? '' : GLOBAL_CONTEXT_REFERENCES;
    const mainBody = patches ? result + ',' + patches : result;
    if (params === '') {
      return patches ? '(' + mainBody + ref + ')' : mainBody;
    }
    const args = this.scopeId == null ? '()' : '(' + GLOBAL_CONTEXT_REFERENCES + '["' + serializeString(this.scopeId) + '"])';
    const body = mainBody + (patches ? ref : '');
    return '(' + createFunction(this.features, [params], body) + ')' + args;
  }
}
