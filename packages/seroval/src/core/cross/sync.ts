import BaseSyncParserContext from '../base-parser/sync';
import type { SerovalMode } from '../plugin';
import type { CrossParserContextOptions } from './cross-parser';

export type CrossSyncParserContextOptions = CrossParserContextOptions

export default class CrossSyncParserContext extends BaseSyncParserContext {
  readonly mode: SerovalMode = 'cross';
}
