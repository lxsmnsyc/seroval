import BaseAsyncParserContext from '../base/async';
import { createIndexedValueNode, createReferenceNode } from '../base-primitives';
import type { BaseParserContextOptions } from '../parser-context';
import { hasReferenceID } from '../reference';
import type { SerovalIndexedValueNode, SerovalReferenceNode } from '../types';

export type AsyncParserContextOptions = BaseParserContextOptions

export default class AsyncParserContext extends BaseAsyncParserContext {
  /**
   * @private
   */
  ids: Map<unknown, number> = new Map();

  /**
   * @private
   */
  marked: Set<number> = new Set();

  /**
   * @private
   */
  protected createIndexedValue<T>(current: T): number {
    const ref = this.ids.get(current);
    if (ref == null) {
      const id = this.ids.size;
      this.ids.set(current, id);
      return id;
    }
    this.marked.add(ref);
    return ref;
  }

  protected getReference<T>(current: T): number | SerovalIndexedValueNode | SerovalReferenceNode {
    const id = this.createIndexedValue(current);
    if (this.marked.has(id)) {
      return createIndexedValueNode(id);
    }
    if (hasReferenceID(current)) {
      return createReferenceNode(id, current);
    }
    return id;
  }
}
