import BaseAsyncParserContext from '../base-parser/async';
import type { CrossParserContextOptions } from './cross-parser';
import type { SerovalMode } from '../plugin';

export type CrossAsyncParserContextOptions = CrossParserContextOptions

export default class CrossAsyncParserContext extends BaseAsyncParserContext {
  readonly mode: SerovalMode = 'cross';
}
