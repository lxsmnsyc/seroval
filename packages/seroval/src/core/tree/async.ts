import type { BaseParserContextOptions } from '../context/parser';
import BaseAsyncParserContext from '../context/parser/async';
import type { SerovalMode } from '../plugin';

export type AsyncParserContextOptions = Omit<BaseParserContextOptions, 'refs'>;

export default class AsyncParserContext extends BaseAsyncParserContext {
  readonly mode: SerovalMode = 'vanilla';
}
