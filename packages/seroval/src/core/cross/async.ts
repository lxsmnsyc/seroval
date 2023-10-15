import BaseAsyncParserContext from '../base/async';
import type { SerovalIndexedValueNode, SerovalReferenceNode } from '../types';
import type { CrossParserContextOptions } from './cross-parser';
import { getCrossReference, getStrictCrossReference } from './cross-parser';
import type { SerovalMode } from '../plugin';

export type CrossAsyncParserContextOptions = CrossParserContextOptions

export default class CrossAsyncParserContext extends BaseAsyncParserContext {
  readonly mode: SerovalMode = 'cross';

  scopeId?: string;

  refs: Map<unknown, number>;

  constructor(options: CrossAsyncParserContextOptions) {
    super(options);
    this.scopeId = options.scopeId;
    this.refs = options.refs || new Map<unknown, number>();
  }

  protected getReference<T>(current: T): number | SerovalIndexedValueNode | SerovalReferenceNode {
    return getCrossReference(this.refs, current);
  }

  protected getStrictReference<T>(current: T): SerovalIndexedValueNode | SerovalReferenceNode {
    return getStrictCrossReference(this.refs, current);
  }
}
