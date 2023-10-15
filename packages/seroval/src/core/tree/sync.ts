import { createIndexedValueNode, createReferenceNode } from '../base-primitives';
import BaseSyncParserContext from '../base/sync';
import type { BaseParserContextOptions } from '../parser-context';
import type { SerovalMode } from '../plugin';
import { hasReferenceID } from '../reference';
import type { SerovalIndexedValueNode, SerovalReferenceNode } from '../types';

export type SyncParserContextOptions = BaseParserContextOptions

export default class SyncParserContext extends BaseSyncParserContext {
  readonly mode: SerovalMode = 'vanilla';

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
