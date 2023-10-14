import type { Assignment, FlaggedObject } from './assignments';
import type { PluginAccessOptions } from './plugin';
import { PluginAccess } from './plugin';

export interface BaseSerializerContextOptions extends PluginAccessOptions {
  features: number;
}

export class BaseSerializerContext extends PluginAccess {
  /**
   * @private
   */
  features: number;

  /**
   * To check if an object is synchronously referencing itself
   * @private
   */
  stack: number[] = [];

  /**
   * Array of object mutations
   * @private
   */
  flags: FlaggedObject[] = [];

  /**
   * Array of assignments to be done (used for recursion)
   * @private
   */
  assignments: Assignment[] = [];

  constructor(options: BaseSerializerContextOptions) {
    super(options);
    this.features = options.features;
  }
}
