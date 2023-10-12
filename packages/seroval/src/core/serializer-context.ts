import type { Assignment, FlaggedObject } from './assignments';

export interface BaseSerializerContextOptions {
  features: number;
}

export class BaseSerializerContext {
  features: number;

  // To check if an object is synchronously referencing itself
  stack: number[] = [];

  // Array of object mutations
  flags: FlaggedObject[] = [];

  // Array of assignments to be done (used for recursion)
  assignments: Assignment[] = [];

  constructor(options: BaseSerializerContextOptions) {
    this.features = options.features;
  }
}
