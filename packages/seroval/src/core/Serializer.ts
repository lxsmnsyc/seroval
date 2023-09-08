import { ALL_ENABLED } from './compat';
import { crossSerializeStream } from './cross';
import { getCrossReferenceHeader } from './keys';
import { serializeString } from './string';

export interface SerializerOptions {
  globalIdentifier: string;
  disabledFeatures?: number;
  onHeader: (result: string) => void;
  onData: (result: string) => void;
}

export default class Serializer {
  private alive = true;

  private cleanups: (() => void)[] = [];

  private refs = new Map<unknown, number>();

  constructor(
    private options: SerializerOptions,
  ) {
    options.onHeader(getCrossReferenceHeader(ALL_ENABLED ^ (options.disabledFeatures || 0)));
  }

  write(key: string, value: unknown): void {
    if (this.alive) {
      this.cleanups.push(crossSerializeStream(value, {
        refs: this.refs,
        disabledFeatures: this.options.disabledFeatures,
        onSerialize: (data, initial) => {
          this.options.onData(
            initial
              ? this.options.globalIdentifier + '["' + serializeString(key) + '"]=' + data
              : data,
          );
        },
      }));
    }
  }

  close(): void {
    if (this.alive) {
      for (let i = 0, len = this.cleanups.length; i < len; i++) {
        this.cleanups[i]();
      }
      this.alive = false;
    }
  }
}