import BaseAsyncParserContext from '../context/parser/async';
import type { SerovalMode } from '../plugin';
import type { CrossParserContextOptions } from './parser';

export type CrossAsyncParserContextOptions = CrossParserContextOptions;

export default class CrossAsyncParserContext extends BaseAsyncParserContext {
  readonly mode: SerovalMode = 'cross';
}
