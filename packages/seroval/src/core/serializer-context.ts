import type { Assignment, FlaggedObject } from './assignments';
import type { Plugin, PluginAccessOptions } from './plugin';

export interface BaseSerializerContextOptions extends PluginAccessOptions {
  features: number;
}

export class BaseSerializerContext implements PluginAccessOptions {
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

  plugins?: Plugin<any, any>[] | undefined;

  constructor(options: BaseSerializerContextOptions) {
    this.plugins = options.plugins;
    this.features = options.features;
  }
}
