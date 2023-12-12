import type { BaseStreamParserContextOptions } from '../context/parser/stream';
import BaseStreamParserContext from '../context/parser/stream';
import type { SerovalMode } from '../plugin';

export type CrossStreamParserContextOptions = BaseStreamParserContextOptions;

export default class CrossStreamParserContext extends BaseStreamParserContext {
  readonly mode: SerovalMode = 'cross';
}
