import type { Assignment, FlaggedObject } from './assignments';

export interface BaseParserContext {
  // Supported features
  features: number;
}

export interface BaseSerializerContext extends BaseParserContext {
  // To check if an object is synchronously referencing itself
  stack: number[];
  // Array of object mutations
  flags: FlaggedObject[];
  // Array of assignments to be done (used for recursion)
  assignments: Assignment[];
}
