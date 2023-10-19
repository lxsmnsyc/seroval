import BaseSyncParserContext from '../base/sync';
import type { BaseParserContextOptions } from '../parser-context';
import type { SerovalMode } from '../plugin';

export type SyncParserContextOptions = Omit<BaseParserContextOptions, 'refs'>;

export default class SyncParserContext extends BaseSyncParserContext {
  readonly mode: SerovalMode = 'vanilla';
}
