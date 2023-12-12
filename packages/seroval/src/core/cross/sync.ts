import BaseSyncParserContext from '../context/parser/sync';
import type { SerovalMode } from '../plugin';
import type { CrossParserContextOptions } from './parser';

export type CrossSyncParserContextOptions = CrossParserContextOptions;

export default class CrossSyncParserContext extends BaseSyncParserContext {
  readonly mode: SerovalMode = 'cross';
}
