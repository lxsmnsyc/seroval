import BaseAsyncParserContext from '../base/async';
import type { BaseParserContextOptions } from '../parser-context';
import type { SerovalMode } from '../plugin';

export type AsyncParserContextOptions = Omit<BaseParserContextOptions, 'refs'>

export default class AsyncParserContext extends BaseAsyncParserContext {
  readonly mode: SerovalMode = 'vanilla';
}
