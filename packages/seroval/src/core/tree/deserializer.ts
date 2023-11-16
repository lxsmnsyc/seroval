import BaseDeserializerContext from '../context/deserializer';
import type { BaseDeserializerOptions } from '../context/deserializer';
import type { SerovalMode } from '../plugin';

export type VanillaDeserializerContextOptions = Omit<BaseDeserializerOptions, 'refs'>;

export default class VanillaDeserializerContext extends BaseDeserializerContext {
  readonly mode: SerovalMode = 'vanilla';

  constructor(options: VanillaDeserializerContextOptions) {
    super({
      plugins: options.plugins,
      markedRefs: options.markedRefs,
    });
  }

  assignIndexedValue<T>(
    index: number,
    value: T,
  ): T {
    if (this.markedRefs.has(index)) {
      this.refs.set(index, value);
    }
    return value;
  }
}
