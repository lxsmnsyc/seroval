import type {
  SerovalIndexedValueNode,
  SerovalReferenceNode,
} from '../types';
import type { BaseStreamParserContextOptions } from '../base/stream';
import BaseStreamParserContext from '../base/stream';
import type { SerovalMode } from '../plugin';
import { getCrossReference, getStrictCrossReference } from './cross-parser';

export type CrossStreamParserContextOptions = BaseStreamParserContextOptions

export default class CrossStreamParserContext extends BaseStreamParserContext {
  readonly mode: SerovalMode = 'cross';

  refs: Map<unknown, number>;

  constructor(options: CrossStreamParserContextOptions) {
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
