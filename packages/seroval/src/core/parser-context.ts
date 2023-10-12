import { ALL_ENABLED, Feature } from './compat';
import { ERROR_CONSTRUCTOR_STRING } from './constants';
import { getErrorConstructor } from './shared';

export interface ParserReference {
  ids: Map<unknown, number>;
  marked: Set<number>;
}

export interface BaseParserContextOptions {
  disabledFeatures?: number;
}

export class BaseParserContext {
  features: number;

  constructor(options: Partial<BaseParserContextOptions>) {
    this.features = ALL_ENABLED ^ (options.disabledFeatures || 0);
  }

  getErrorOptions(
    error: Error,
  ): Record<string, unknown> | undefined {
    let options: Record<string, unknown> | undefined;
    const constructor = ERROR_CONSTRUCTOR_STRING[getErrorConstructor(error)];
    // Name has been modified
    if (error.name !== constructor) {
      options = { name: error.name };
    } else if (error.constructor.name !== constructor) {
      // Otherwise, name is overriden because
      // the Error class is extended
      options = { name: error.constructor.name };
    }
    const names = Object.getOwnPropertyNames(error);
    for (const name of names) {
      if (name !== 'name' && name !== 'message') {
        if (name === 'stack') {
          if (this.features & Feature.ErrorPrototypeStack) {
            options = options || {};
            options[name] = error[name as keyof Error];
          }
        } else {
          options = options || {};
          options[name] = error[name as keyof Error];
        }
      }
    }
    return options;
  }
}
