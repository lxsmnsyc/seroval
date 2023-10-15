import BaseSyncParserContext from '../base/sync';
import type { BaseParserContextOptions } from '../parser-context';
import type { SerovalMode } from '../plugin';
import type { SerovalIndexedValueNode, SerovalReferenceNode } from '../types';
import { getStrictVanillaReference, getVanillaReference } from './parser';

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

  protected getReference<T>(current: T): number | SerovalIndexedValueNode | SerovalReferenceNode {
    return getVanillaReference(this.ids, this.marked, current);
  }

  protected getStrictReference<T>(current: T): SerovalIndexedValueNode | SerovalReferenceNode {
    return getStrictVanillaReference(this.ids, this.marked, current);
  }
}
