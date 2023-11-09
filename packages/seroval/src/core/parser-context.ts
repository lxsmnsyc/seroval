import { createIndexedValueNode, createReferenceNode } from './base-primitives';
import { ALL_ENABLED } from './compat';
import { SerovalNodeType } from './constants';
import type { Plugin, PluginAccessOptions, SerovalMode } from './plugin';
import { hasReferenceID } from './reference';
import type { SpecialReference } from './special-reference';
import { SPECIAL_REF_SYMBOL } from './special-reference';
import type {
  SerovalIndexedValueNode, SerovalReferenceNode, SerovalSpecialReferenceNode,
} from './types';

export interface BaseParserContextOptions extends PluginAccessOptions {
  disabledFeatures?: number;
  refs?: Map<unknown, number>;
}

export abstract class BaseParserContext implements PluginAccessOptions {
  abstract readonly mode: SerovalMode;

  features: number;

  marked = new Set<number>();

  refs: Map<unknown, number>;

  plugins?: Plugin<any, any>[] | undefined;

  constructor(options: BaseParserContextOptions) {
    this.plugins = options.plugins;
    this.features = ALL_ENABLED ^ (options.disabledFeatures || 0);
    this.refs = options.refs || new Map<unknown, number>();
  }

  protected markRef(id: number): void {
    this.marked.add(id);
  }

  protected isMarked(id: number): boolean {
    return this.marked.has(id);
  }

  protected getReference<T>(current: T): number | SerovalIndexedValueNode | SerovalReferenceNode {
    const registeredID = this.refs.get(current);
    if (registeredID != null) {
      this.markRef(registeredID);
      return createIndexedValueNode(registeredID);
    }
    const id = this.refs.size;
    this.refs.set(current, id);
    if (hasReferenceID(current)) {
      return createReferenceNode(id, current);
    }
    return id;
  }

  protected getStrictReference<T>(current: T): SerovalIndexedValueNode | SerovalReferenceNode {
    const registeredID = this.refs.get(current);
    if (registeredID != null) {
      this.markRef(registeredID);
      return createIndexedValueNode(registeredID);
    }
    const id = this.refs.size;
    this.refs.set(current, id);
    return createReferenceNode(id, current);
  }

  protected parseSpecialReference(
    current: SpecialReference,
  ): SerovalIndexedValueNode | SerovalReferenceNode | SerovalSpecialReferenceNode {
    const ref = this.getReference(SPECIAL_REF_SYMBOL[current]);
    if (typeof ref === 'number') {
      return {
        t: SerovalNodeType.SpecialReference,
        i: ref,
        s: current,
        l: undefined,
        c: undefined,
        m: undefined,
        p: undefined,
        e: undefined,
        a: undefined,
        f: undefined,
        b: undefined,
        o: undefined,
        x: undefined,
      };
    }
    return ref;
  }
}
