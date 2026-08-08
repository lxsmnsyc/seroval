import { crossSerializeStream } from './cross';
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

  private cleanups: (() => void)[] = [];

  private refs = new Map<unknown, number>();

  private plugins?: Plugin<any, any>[];

  constructor(private options: SerializerOptions) {
    this.plugins = resolvePlugins(options.plugins);
  }

  keys = new Set<string>();

  /**
   * Serializes `value` and assigns the result to `globalIdentifier[key]` on the
   * target realm, streaming chunks through `onData` as async parts resolve.
   */
  write(key: string, value: unknown): void {
    if (this.alive && !this.flushed) {
      this.pending++;
      this.keys.add(key);
      this.cleanups.push(
        crossSerializeStream(value, {
          plugins: this.plugins,
          scopeId: this.options.scopeId,
          refs: this.refs,
          disabledFeatures: this.options.disabledFeatures,
          onError: this.options.onError,
          onSerialize: (data, initial) => {
            if (this.alive) {
              this.options.onData(
                initial
                  ? this.options.globalIdentifier +
                      '["' +
                      serializeString(key) +
                      '"]=' +
                      data
                  : data,
              );
            }
          },
          onDone: () => {
            if (this.alive) {
              this.pending--;
              if (
                this.pending <= 0 &&
                this.flushed &&
                !this.done &&
                this.options.onDone
              ) {
                this.options.onDone();
                this.done = true;
              }
            }
          },
        }),
      );
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
      if (this.pending <= 0 && !this.done && this.options.onDone) {
        this.options.onDone();
        this.done = true;
      }
    }
  }

  /**
   * Aborts serialization immediately, cancelling any pending async values and
   * releasing their resources, then calls `onDone`.
   */
  close(): void {
    if (this.alive) {
      for (let i = 0, len = this.cleanups.length; i < len; i++) {
        this.cleanups[i]();
      }
      if (!this.done && this.options.onDone) {
        this.options.onDone();
        this.done = true;
      }
      this.alive = false;
    }
  }
}
