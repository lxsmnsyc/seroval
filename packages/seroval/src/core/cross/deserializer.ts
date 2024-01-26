import type { BaseDeserializerOptions } from '../context/deserializer';
import BaseDeserializerContext from '../context/deserializer';
import type { SerovalMode } from '../plugin';

export type CrossDeserializerContextOptions = BaseDeserializerOptions;

export default class CrossDeserializerContext extends BaseDeserializerContext {
  readonly mode: SerovalMode = 'cross';

  assignIndexedValue<T>(index: number, value: T): T {
    if (!this.refs.has(index)) {
      this.refs.set(index, value);
    }
    return value;
  }
}
