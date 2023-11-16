import BaseDeserializerContext from '../context/deserializer';
import type { BaseDeserializerOptions } from '../context/deserializer';
import type { SerovalMode } from '../plugin';

export type VanillaDeserializerContextOptions = Omit<BaseDeserializerOptions, 'refs'>;

export default class VanillaDeserializerContext extends BaseDeserializerContext {
  readonly mode: SerovalMode = 'vanilla';
}
