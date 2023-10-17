import type { BaseParserContextOptions } from '../parser-context';

export interface CrossParserContextOptions extends BaseParserContextOptions {
  refs?: Map<unknown, number>;
}

export interface CrossContextOptions {
  scopeId?: string;
}
