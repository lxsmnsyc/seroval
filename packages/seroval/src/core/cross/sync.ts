import BaseSyncParserContext from '../base/sync';
import type { SerovalMode } from '../plugin';
import type { SerovalIndexedValueNode, SerovalReferenceNode } from '../types';
import { getStrictCrossReference, type CrossParserContextOptions, getCrossReference } from './cross-parser';

export type CrossSyncParserContextOptions = CrossParserContextOptions

export default class CrossSyncParserContext extends BaseSyncParserContext {
  readonly mode: SerovalMode = 'cross';

  refs: Map<unknown, number>;

  constructor(options: CrossSyncParserContextOptions) {
    super(options);
    this.refs = options.refs || new Map<unknown, number>();
  }

  protected getReference<T>(current: T): number | SerovalIndexedValueNode | SerovalReferenceNode {
    return getCrossReference(this.refs, current);
  }

  protected getStrictReference<T>(current: T): SerovalIndexedValueNode | SerovalReferenceNode {
    return getStrictCrossReference(this.refs, current);
  }
}
