import BaseAsyncParserContext from '../context/parser/async';
import type { CrossParserContextOptions } from './parser';
import type { SerovalMode } from '../plugin';

export type CrossAsyncParserContextOptions = CrossParserContextOptions;

export default class CrossAsyncParserContext extends BaseAsyncParserContext {
  readonly mode: SerovalMode = 'cross';
}
