import { SerovalNodeType } from '../constants';
import type { BaseSerializerContextOptions } from '../context/serializer';
import BaseSerializerContext from '../context/serializer';
import { SerovalUnsupportedNodeError } from '../errors';
import type { SerovalMode } from '../plugin';
import type {
  SerovalNode,
  SerovalPromiseConstructorNode,
  SerovalPromiseRejectNode,
  SerovalPromiseResolveNode,
} from '../types';
import getIdentifier from '../utils/get-identifier';

export type VanillaSerializerContextOptions = BaseSerializerContextOptions;

export default class VanillaSerializerContext extends BaseSerializerContext {
  readonly mode: SerovalMode = 'vanilla';

  /**
   * Map tree refs to actual refs
   * @private
   */
  valid = new Map<number, number>();

  /**
   * Variables
   * @private
   */
  vars: string[] = [];

  /**
   * Creates the reference param (identifier) from the given reference ID
   * Calling this function means the value has been referenced somewhere
   */
  getRefParam(index: number): string {
    /**
     * Creates a new reference ID from a given reference ID
     * This new reference ID means that the reference itself
     * has been referenced at least once, and is used to generate
     * the variables
     */
    let actualIndex = this.valid.get(index);
    if (actualIndex == null) {
      actualIndex = this.valid.size;
      this.valid.set(index, actualIndex);
    }
    let identifier = this.vars[actualIndex];
    if (identifier == null) {
      identifier = getIdentifier(actualIndex);
      this.vars[actualIndex] = identifier;
    }
    return identifier;
  }

  protected assignIndexedValue(index: number, value: string): string {
    if (this.isMarked(index)) {
      return this.getRefParam(index) + '=' + value;
    }
    return value;
  }

  protected serializePromiseConstructor(
    node: SerovalPromiseConstructorNode,
  ): string {
    throw new SerovalUnsupportedNodeError(node);
  }

  protected serializePromiseResolve(node: SerovalPromiseResolveNode): string {
    throw new SerovalUnsupportedNodeError(node);
  }

  protected serializePromiseReject(node: SerovalPromiseRejectNode): string {
    throw new SerovalUnsupportedNodeError(node);
  }

  serializeTop(tree: SerovalNode): string {
    const result = this.serialize(tree);
    // Shared references detected
    if (tree.i != null && this.vars.length) {
      const patches = this.resolvePatches();
      let body = result;
      if (patches) {
        // Get (or create) a ref from the source
        const index = this.getRefParam(tree.i);
        body = result + ',' + patches + index;
        if (!result.startsWith(index + '=')) {
          body = index + '=' + body;
        }
        body = '(' + body + ')';
      }
      return '(' + this.createFunction(this.vars, body) + ')()';
    }
    if (tree.t === SerovalNodeType.Object) {
      return '(' + result + ')';
    }
    return result;
  }
}
