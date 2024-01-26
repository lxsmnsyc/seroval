import type { BaseDeserializerOptions } from '../context/deserializer';
import BaseDeserializerContext from '../context/deserializer';
import type { SerovalMode } from '../plugin';

export interface VanillaDeserializerContextOptions
  extends Omit<BaseDeserializerOptions, 'refs'> {
  markedRefs: number[] | Set<number>;
}

export default class VanillaDeserializerContext extends BaseDeserializerContext {
  readonly mode: SerovalMode = 'vanilla';

  marked: Set<number>;

  constructor(options: VanillaDeserializerContextOptions) {
    super(options);
    this.marked = new Set(options.markedRefs);
  }

  assignIndexedValue<T>(index: number, value: T): T {
    if (this.marked.has(index)) {
      this.refs.set(index, value);
    }
    return value;
  }
}
