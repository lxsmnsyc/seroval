import type {
  SerovalNode,
  SerovalPromiseConstructorNode,
  SerovalPromiseRejectNode,
  SerovalPromiseResolveNode,
  SerovalReadableStreamCloseNode,
  SerovalReadableStreamConstructorNode,
  SerovalReadableStreamEnqueueNode,
  SerovalReadableStreamErrorNode,
} from '../types';
import type { BaseSerializerContextOptions } from '../serializer-context';
import BaseSerializerContext from '../serializer-context';
import getIdentifier from '../get-identifier';
import type { SerovalMode } from '../plugin';
import { Feature } from '../compat';
import { SerovalNodeType } from '../constants';

export interface VanillaSerializerContextOptions extends BaseSerializerContextOptions {
  markedRefs: number[] | Set<number>;
}

export default class VanillaSerializerContext extends BaseSerializerContext {
  readonly mode: SerovalMode = 'cross';

  /**
   * Amount of refs
   * @private
   */
  size = 0;

  /**
   * Map tree refs to actual refs
   * @private
   */
  valid: (number | undefined)[] = [];

  /**
   * Refs that are...referenced
   * @private
   */
  marked: Set<number>;

  /**
   * Variables
   * @private
   */
  vars: (string | undefined)[] = [];

  constructor(options: VanillaSerializerContextOptions) {
    super(options);
    this.marked = new Set(options.markedRefs);
  }

  /**
   * Increments the number of references the referenced value has
   */
  markRef(
    current: number,
  ): void {
    this.marked.add(current);
  }

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
    let actualIndex = this.valid[index];
    if (actualIndex == null) {
      actualIndex = this.size++;
      this.valid[index] = actualIndex;
    }
    let identifier = this.vars[actualIndex];
    if (identifier == null) {
      identifier = getIdentifier(actualIndex);
      this.vars[actualIndex] = identifier;
    }
    return identifier;
  }

  protected assignIndexedValue(
    index: number,
    value: string,
  ): string {
    if (this.marked.has(index)) {
      return this.getRefParam(index) + '=' + value;
    }
    return value;
  }

  protected serializePromiseConstructor(
    node: SerovalPromiseConstructorNode,
  ): string {
    throw new Error('Unsupported node type "' + node.t + '".');
  }

  protected serializePromiseResolve(
    node: SerovalPromiseResolveNode,
  ): string {
    throw new Error('Unsupported node type "' + node.t + '".');
  }

  protected serializePromiseReject(
    node: SerovalPromiseRejectNode,
  ): string {
    throw new Error('Unsupported node type "' + node.t + '".');
  }

  protected serializeReadableStreamConstructor(
    node: SerovalReadableStreamConstructorNode,
  ): string {
    throw new Error('Unsupported node type "' + node.t + '".');
  }

  protected serializeReadableStreamEnqueue(
    node: SerovalReadableStreamEnqueueNode,
  ): string {
    throw new Error('Unsupported node type "' + node.t + '".');
  }

  protected serializeReadableStreamError(
    node: SerovalReadableStreamErrorNode,
  ): string {
    throw new Error('Unsupported node type "' + node.t + '".');
  }

  protected serializeReadableStreamClose(
    node: SerovalReadableStreamCloseNode,
  ): string {
    throw new Error('Unsupported node type "' + node.t + '".');
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
      }
      let params = this.vars.length > 1
        ? this.vars.join(',')
        : this.vars[0];
      // Source is probably already assigned
      if (this.features & Feature.ArrowFunction) {
        params = this.vars.length > 1 || this.vars.length === 0
          ? '(' + params + ')'
          : params;
        return '(' + params + '=>(' + body + '))()';
      }
      return '(function(' + params + '){return ' + body + '})()';
    }
    if (tree.t === SerovalNodeType.Object) {
      return '(' + result + ')';
    }
    return result;
  }
}
