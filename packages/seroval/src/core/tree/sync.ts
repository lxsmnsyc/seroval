import BaseSyncParserContext from '../context/parser/sync';
import type { BaseParserContextOptions } from '../context/parser';
import type { SerovalMode } from '../plugin';

export type SyncParserContextOptions = Omit<BaseParserContextOptions, 'refs'>;

export default class SyncParserContext extends BaseSyncParserContext {
  readonly mode: SerovalMode = 'vanilla';
}
