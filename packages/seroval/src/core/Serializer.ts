import { crossSerializeStream } from './cross';
import { SerovalParserError } from './errors';
import {
  type Plugin,
  type PluginAccessOptions,
  resolvePlugins,
} from './plugin';
import { serializeString } from './string';

export interface SerializerOptions extends PluginAccessOptions {
  globalIdentifier: string;
  scopeId?: string;
  disabledFeatures?: number;
  compactArrayBufferViews?: boolean;
  depthLimit?: number;
  onData: (result: string) => void;
  onError?: (error: unknown) => void;
  onDone?: () => void;
}

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
        onError: error => this.fail(error),
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
        onDone: () => {
          if (this.alive) {
            this.pending--;
            if (this.pending <= 0 && this.flushed && !this.done) {
              this.close();
            }
          }
        },
      });
      if (this.alive) {
        this.cleanups.push(cleanup);
      } else {
        cleanup();
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

  push(value: unknown): string {
    const newID = this.getNextID();
    this.write(newID, value);
    return newID;
  }

  flush(): void {
    if (this.alive) {
      this.flushed = true;
      if (this.pending <= 0 && !this.done) {
        this.close();
      }
    }
  }

  close(): void {
    this.finish(true);
  }

  private fail(reason: unknown): void {
    const onError = this.options?.onError;
    const primary =
      onError || reason instanceof SerovalParserError
        ? reason
        : new SerovalParserError(reason);
    let cleanupFailure: { value: unknown } | undefined;
    try {
      this.finish(false, primary);
    } catch (error) {
      cleanupFailure = { value: error };
    }
    // A cleanup failure must not replace an unhandled parsing error or an
    // exception thrown by its error handler. All cleanups have already run.
    if (!onError) {
      throw primary;
    }
    onError(reason);
    if (cleanupFailure) {
      throw cleanupFailure.value;
    }
  }

  private finish(notify: boolean, reason?: unknown): void {
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
          cleanups[index](reason);
        } catch (error) {
          failure ??= { value: error };
        }
      }
      this.refs.clear();
      if (!this.done) {
        this.done = true;
        try {
          if (notify) {
            options?.onDone?.();
          }
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
