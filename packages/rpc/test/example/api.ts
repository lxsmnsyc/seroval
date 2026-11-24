import type { CallContext, Channel } from '../../src/types';

/** The channel that the caller hands to the worker to hear about progress. */
export type ProgressFunctions = {
  report(done: number, total: number): void;
};

/** The root channel that the worker serves. */
export type SearchFunctions = {
  /** Indexes the documents and reports progress through the caller's channel. */
  load(
    this: CallContext,
    documents: string[],
    progress?: Channel<ProgressFunctions>,
  ): Promise<number>;
  /** Returns the documents that contain every word of the query. */
  search(this: CallContext, query: string): Promise<string[]>;
  /** A search that never finishes by itself. It stops when the call cancels. */
  scan(this: CallContext, query: string): Promise<string[]>;
  /** True when the last `scan` saw its signal abort. */
  scanWasCancelled(this: CallContext): Promise<boolean>;
  /**
   * A two-way generator. The worker yields matches; the caller sends back
   * `next(word)` to narrow the query by one word.
   */
  browse(this: CallContext, query: string): AsyncGenerator<string, void, string | undefined>;
  /** The worker closes its side. */
  quit(this: CallContext): void;
};
