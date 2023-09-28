import { crossSerializeStream } from './cross';
import { serializeString } from './string';

export interface SerializerOptions {
  globalIdentifier: string;
  scopeId?: string;
  disabledFeatures?: number;
  onData: (result: string) => void;
  onDone?: () => void;
}

export default class Serializer {
  private alive = true;

  private flushed = false;

  private done = false;

  private pending = 0;

  private cleanups: (() => void)[] = [];

  private refs = new Map<unknown, number>();

  constructor(
    private options: SerializerOptions,
  ) {
  }

  write(key: string, value: unknown): void {
    if (this.alive && !this.flushed) {
      this.pending++;
      this.cleanups.push(crossSerializeStream(value, {
        scopeId: this.options.scopeId,
        refs: this.refs,
        disabledFeatures: this.options.disabledFeatures,
        onSerialize: (data, initial) => {
          if (this.alive) {
            this.options.onData(
              initial
                ? this.options.globalIdentifier + '["' + serializeString(key) + '"]=' + data
                : data,
            );
          }
        },
        onDone: () => {
          if (this.alive) {
            this.pending--;
            if (this.pending <= 0 && this.flushed && !this.done && this.options.onDone) {
              this.options.onDone();
              this.done = true;
            }
          }
        },
      }));
    }
  }

  flush(): void {
    if (this.alive) {
      this.flushed = true;
      if (this.pending <= 0 && !this.done && this.options.onDone) {
        this.options.onDone();
        this.done = true;
      }
    }
  }

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
