import type { BaseParserContextOptions } from '../parser-context';

export interface CrossParserContextOptions extends BaseParserContextOptions {
  scopeId?: string;
  refs?: Map<unknown, number>;
}
