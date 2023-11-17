import type {
  SerovalPromiseConstructorNode,
  SerovalPromiseResolveNode,
  SerovalPromiseRejectNode,
  SerovalReadableStreamCloseNode,
  SerovalReadableStreamEnqueueNode,
  SerovalReadableStreamErrorNode,
  SerovalReadableStreamConstructorNode,
  SerovalNode,
  SerovalAsyncIteratorNode,
} from '../types';
import {
  GLOBAL_CONTEXT_PROMISE_REJECT,
  GLOBAL_CONTEXT_PROMISE_RESOLVE,
  GLOBAL_CONTEXT_PROMISE_CONSTRUCTOR,
  GLOBAL_CONTEXT_REFERENCES,
  GLOBAL_CONTEXT_STREAM_CONSTRUCTOR,
  GLOBAL_CONTEXT_STREAM_ENQUEUE,
  GLOBAL_CONTEXT_STREAM_CLOSE,
  GLOBAL_CONTEXT_STREAM_ERROR,
  GLOBAL_CONTEXT_API,
} from '../keys';
import type { BaseSerializerContextOptions } from '../context/serializer';
import BaseSerializerContext from '../context/serializer';
import type { SerovalMode } from '../plugin';
import { serializeString } from '../string';
import type { CrossContextOptions } from './parser';
import { createEffectfulFunction, createFunction } from '../utils/function-string';
import { SpecialReference } from '../special-reference';

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
    return GLOBAL_CONTEXT_API + '.' + GLOBAL_CONTEXT_STREAM_ENQUEUE + '(' + this.getRefParam(node.i) + ',' + this.serialize(node.f) + ')';
  }

  protected serializeReadableStreamError(
    node: SerovalReadableStreamErrorNode,
  ): string {
    return GLOBAL_CONTEXT_API + '.' + GLOBAL_CONTEXT_STREAM_ERROR + '(' + this.getRefParam(node.i) + ',' + this.serialize(node.f) + ')';
  }

  protected serializeReadableStreamClose(
    node: SerovalReadableStreamCloseNode,
  ): string {
    return GLOBAL_CONTEXT_API + '.' + GLOBAL_CONTEXT_STREAM_CLOSE + '(' + this.getRefParam(node.i) + ')';
  }

  protected serializeAsyncIterator(node: SerovalAsyncIteratorNode): string {
    return this.assignIndexedValue(
      node.i,
      createFunction(
        this.features,
        ['s'],
        createFunction(
          this.features,
          ['b'],
          '(b=s.tee(),s=b[0],b=b[1].getReader(),{[' + this.serialize(node.x[SpecialReference.SymbolAsyncIterator]) + ']:' + createFunction(this.features, [], 'this') + ','
          + 'next:' + createFunction(
            this.features,
            [],
            'b.read().then(' + createEffectfulFunction(
              this.features,
              ['d'],
              'if(d.done)return{done:!0,value:void 0};d=d.value;if(d[0]===1)throw d[1];return{done:d[0]===2,value:d[1]}',
            ) + ')',
          ) + '})',
        ),
      ),
    );
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
