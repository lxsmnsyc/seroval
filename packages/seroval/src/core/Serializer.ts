import { crossSerializeStream } from './cross';
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
  onData: (result: string) => void;
  onError: (error: unknown) => void;
  onDone?: () => void;
}

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

  write(key: string, value: unknown): void {
    if (this.alive && !this.flushed) {
      this.pending++;
      this.keys.add(key);
      const cleanup = crossSerializeStream(value, {
        plugins: this.plugins,
        scopeId: this.options.scopeId,
        refs: this.refs,
        disabledFeatures: this.options.disabledFeatures,
        compactArrayBufferViews: this.options.compactArrayBufferViews,
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
              this.done = true;
              this.options.onDone();
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
      if (this.pending <= 0 && !this.done && this.options.onDone) {
        this.done = true;
        this.options.onDone();
      }
    }
  }

  close(): void {
    if (this.alive) {
      this.alive = false;
      let failure: { value: unknown } | undefined;
      for (
        let index = 0, length = this.cleanups.length;
        index < length;
        index++
      ) {
        try {
          this.cleanups[index]();
        } catch (error) {
          failure ??= { value: error };
        }
      }
      this.cleanups.length = 0;
      this.refs.clear();
      if (!this.done && this.options.onDone) {
        this.done = true;
        try {
          this.options.onDone();
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
