import BaseAsyncParserContext from '../base/async';
import { createIndexedValueNode, createReferenceNode } from '../base-primitives';
import { hasReferenceID } from '../reference';
import type { SerovalIndexedValueNode, SerovalReferenceNode } from '../types';
import type { CrossParserContextOptions } from './cross-parser';

export type CrossAsyncParserContextOptions = CrossParserContextOptions

export default class CrossAsyncParserContext extends BaseAsyncParserContext {
  scopeId?: string;

  refs: Map<unknown, number>;

  constructor(options: CrossAsyncParserContextOptions) {
    super(options);
    this.scopeId = options.scopeId;
    this.refs = options.refs || new Map<unknown, number>();
  }

  protected getReference<T>(current: T): number | SerovalIndexedValueNode | SerovalReferenceNode {
    const registeredID = this.refs.get(current);
    if (registeredID != null) {
      return createIndexedValueNode(registeredID);
    }
    const id = this.refs.size;
    this.refs.set(current, id);
    if (hasReferenceID(current)) {
      return createReferenceNode(id, current);
    }
    return id;
  }
}
