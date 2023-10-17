import type { BaseStreamParserContextOptions } from '../base/stream';
import BaseStreamParserContext from '../base/stream';
import type { SerovalMode } from '../plugin';

export type CrossStreamParserContextOptions = BaseStreamParserContextOptions

export default class CrossStreamParserContext extends BaseStreamParserContext {
  readonly mode: SerovalMode = 'cross';
}
