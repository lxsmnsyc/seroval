import type { Assignment, FlaggedObject } from './assignments';
import { ALL_ENABLED, Feature } from './compat';
import { getErrorConstructorName } from './shared';

export interface ParserReference {
  ids: Map<unknown, number>;
  marked: Set<number>;
}

export interface BaseParserContextOptions {
  disabledFeatures: number;
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
    const constructor = getErrorConstructorName(error);
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

export interface BaseSerializerContext {
  features: number;
  // To check if an object is synchronously referencing itself
  stack: number[];
  // Array of object mutations
  flags: FlaggedObject[];
  // Array of assignments to be done (used for recursion)
  assignments: Assignment[];
}
