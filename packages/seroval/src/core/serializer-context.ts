import type { Assignment, FlaggedObject } from './assignments';

export interface BaseSerializerContextOptions {
  features: number;
}

export class BaseSerializerContext {
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
    this.features = options.features;
  }
}
