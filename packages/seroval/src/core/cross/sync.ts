import { createIndexedValueNode, createReferenceNode } from '../base-primitives';
import BaseSyncParserContext from '../base/sync';
import { hasReferenceID } from '../reference';
import type { SerovalIndexedValueNode, SerovalReferenceNode } from '../types';
import type { CrossParserContextOptions } from './cross-parser';

export type CrossSyncParserContextOptions = CrossParserContextOptions

export default class CrossSyncParserContext extends BaseSyncParserContext {
  scopeId?: string;

  refs: Map<unknown, number>;

  constructor(options: CrossSyncParserContextOptions) {
    super(options);
    this.scopeId = options.scopeId;
    this.refs = options.refs || new Map<unknown, number>();
  }

  /**
   * @private
   */
  protected createIndexedValue<T>(current: T): number {
    const ref = this.refs.get(current);
    if (ref == null) {
      const id = this.refs.size;
      this.refs.set(current, id);
      return id;
    }
    return ref;
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
