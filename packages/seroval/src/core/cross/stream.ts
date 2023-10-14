import { hasReferenceID } from '../reference';
import type {
  SerovalIndexedValueNode,
  SerovalReferenceNode,
} from '../types';
import {
  createIndexedValueNode,
  createReferenceNode,
} from '../base-primitives';
import type { BaseStreamParserContextOptions } from '../base/stream';
import BaseStreamParserContext from '../base/stream';

export interface CrossStreamParserContextOptions extends BaseStreamParserContextOptions {
  scopeId?: string;
}

export default class CrossStreamParserContext extends BaseStreamParserContext {
  scopeId?: string;

  refs: Map<unknown, number>;

  constructor(options: CrossStreamParserContextOptions) {
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
