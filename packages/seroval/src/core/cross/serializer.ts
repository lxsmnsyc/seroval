import type { BaseSerializerContextOptions } from '../context/serializer';
import BaseSerializerContext from '../context/serializer';
import { GLOBAL_CONTEXT_REFERENCES } from '../keys';
import type { SerovalMode } from '../plugin';
import { serializeString } from '../string';
import type { SerovalNode } from '../types';
import type { CrossContextOptions } from './parser';

export interface CrossSerializerContextOptions
  extends BaseSerializerContextOptions,
    CrossContextOptions {}

export default class CrossSerializerContext extends BaseSerializerContext {
  readonly mode: SerovalMode = 'cross';

  scopeId?: string;

  constructor(options: CrossSerializerContextOptions) {
    super(options);
    this.scopeId = options.scopeId;
  }

  getRefParam(id: number): string {
    return GLOBAL_CONTEXT_REFERENCES + '[' + id + ']';
  }

  protected assignIndexedValue(index: number, value: string): string {
    // In cross-reference, we have to assume that
    // every reference are going to be referenced
    // in the future, and so we need to store
    // all of it into the reference array.
    return this.getRefParam(index) + '=' + value;
  }

  serializeTop(tree: SerovalNode): string {
    // Get the serialized result
    const result = this.serialize(tree);
    // If the node is a non-reference, return
    // the result immediately
    const id = tree.i;
    if (id == null) {
      return result;
    }
    // Get the patches
    const patches = this.resolvePatches();
    // Get the variable that represents the root
    const ref = this.getRefParam(id);
    // Parameters needed for scoping
    const params = this.scopeId == null ? '' : GLOBAL_CONTEXT_REFERENCES;
    // If there are patches, append it after the result
    const body = patches ? result + ',' + patches + ref : result;
    // If there are no params, there's no need to generate a function
    if (params === '') {
      return patches ? '(' + body + ')' : body;
    }
    // Get the arguments for the IIFE
    const args =
      this.scopeId == null
        ? '()'
        : '(' +
          GLOBAL_CONTEXT_REFERENCES +
          '["' +
          serializeString(this.scopeId) +
          '"])';
    // Create the IIFE
    return '(' + this.createFunction([params], body) + ')' + args;
  }
}
