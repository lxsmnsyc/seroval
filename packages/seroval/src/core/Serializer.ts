import { crossSerializeStream } from './cross';
import { SerovalParserError } from './errors';
import {
  type Plugin,
  type PluginAccessOptions,
  resolvePlugins,
} from './plugin';
import { serializeString } from './string';

/** Options for the incremental {@link Serializer}. */
export interface SerializerOptions extends PluginAccessOptions {
  /** Expression the emitted chunks assign onto on the target realm, e.g. `self.$R`. */
  globalIdentifier: string;
  /** Scopes the shared cross-reference table; see {@link getCrossReferenceHeader}. */
  scopeId?: string;
  /** Feature flags to disable; see {@link Feature}. */
  disabledFeatures?: number;
  /** Encodes typed arrays and DataViews compactly; see the compact views docs. */
  compactArrayBufferViews?: boolean;
  /** Maximum nesting depth before serialization throws. */
  depthLimit?: number;
  /** Called with each serialized chunk. */
  onData: (result: string) => void;
  /** Called when serializing a value fails. */
  onError: (error: unknown) => void;
  /** Called after {@link Serializer.flush} once all pending values have settled. */
  onDone?: () => void;
}

/**
 * A stateful, incremental cross-serializer. Feed it values one at a time with
 * {@link Serializer.write} or {@link Serializer.push}; each produces cross-
 * referenced chunks through `onData` that assign onto the `globalIdentifier`
 * object on the target realm. Call {@link Serializer.flush} once every value
 * has been written, or {@link Serializer.close} to abort. It shares one `refs`
 * map across all writes, so values repeated between them are emitted once.
 */
export default class Serializer {
  private alive = true;

  private flushed = false;

  private done = false;

  private pending = 0;

  private cleanups: ((reason?: unknown) => void)[] = [];

  private refs = new Map<unknown, number>();

  private plugins?: Plugin<any, any>[];

  private options: SerializerOptions | undefined;

  constructor(options: SerializerOptions) {
    this.options = options;
    this.plugins = resolvePlugins(options.plugins);
  }

  keys = new Set<string>();

  /**
   * Serializes `value` and assigns the result to `globalIdentifier[key]` on the
   * target realm, streaming chunks through `onData` as async parts resolve.
   */
  write(key: string, value: unknown): void {
    const options = this.options;
    if (this.alive && !this.flushed && options) {
      this.pending++;
      this.keys.add(key);
      const cleanup = crossSerializeStream(value, {
        plugins: this.plugins,
        scopeId: options.scopeId,
        refs: this.refs,
        disabledFeatures: options.disabledFeatures,
        compactArrayBufferViews: options.compactArrayBufferViews,
        depthLimit: options.depthLimit,
        onError: error => {
          let failure: { value: unknown } | undefined;
          try {
            if (options.onError) {
              options.onError(error);
            } else {
              throw error instanceof SerovalParserError
                ? error
                : new SerovalParserError(error);
            }
          } catch (error) {
            failure = { value: error };
          }
          try {
            this.finishWrite();
          } catch (error) {
            failure ??= { value: error };
          }
          if (failure) {
            throw failure.value;
          }
        },
        onSerialize: (data, initial) => {
          const current = this.options;
          if (this.alive && current) {
            current.onData(
              initial
                ? current.globalIdentifier +
                    '["' +
                    serializeString(key) +
                    '"]=' +
                    data
                : data,
            );
          }
        },
        onDone: () => this.finishWrite(),
      });
      if (this.alive) {
        this.cleanups.push(cleanup);
      } else {
        cleanup();
      }
    }
  }

  private finishWrite(): void {
    if (this.alive) {
      this.pending--;
      if (this.pending <= 0 && this.flushed && !this.done) {
        this.close();
      }
    }
  }

  ids = 0;

  private getNextID(): string {
    while (this.keys.has('' + this.ids)) {
      this.ids++;
    }
    return '' + this.ids;
  }

  /**
   * Like {@link Serializer.write} but generates a fresh key for the value.
   * @returns The generated key the value was assigned to.
   */
  push(value: unknown): string {
    const newID = this.getNextID();
    this.write(newID, value);
    return newID;
  }

  /**
   * Signals that no more values will be written. Once every pending async value
   * has settled, `onDone` is called. Writes after this are ignored.
   */
  flush(): void {
    if (this.alive) {
      this.flushed = true;
      if (this.pending <= 0 && !this.done) {
        this.close();
      }
    }
  }

  /**
   * Aborts serialization immediately, cancelling any pending async values and
   * releasing their resources, then calls `onDone`.
   */
  close(): void {
    this.finish();
  }

  private finish(): void {
    if (this.alive) {
      this.alive = false;
      const options = this.options;
      this.options = undefined;
      this.plugins = undefined;
      const cleanups = this.cleanups;
      this.cleanups = [];
      let failure: { value: unknown } | undefined;
      for (let index = 0, length = cleanups.length; index < length; index++) {
        try {
          cleanups[index]();
        } catch (error) {
          failure ??= { value: error };
        }
      }
      this.refs.clear();
      if (!this.done) {
        this.done = true;
        try {
          options?.onDone?.();
        } catch (error) {
          failure ??= { value: error };
        }
      }
      if (failure) {
        throw failure.value;
      }
    }
  }
}
