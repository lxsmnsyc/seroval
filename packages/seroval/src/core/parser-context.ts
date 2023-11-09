import { createIndexedValueNode, createReferenceNode } from './base-primitives';
import { ALL_ENABLED } from './compat';
import type { Plugin, PluginAccessOptions, SerovalMode } from './plugin';
import { hasReferenceID } from './reference';
import type { SpecialReferenceState } from './special-reference';
import { createSpecialReferenceState } from './special-reference';
import type { SerovalIndexedValueNode, SerovalReferenceNode } from './types';

export interface BaseParserContextOptions extends PluginAccessOptions {
  disabledFeatures?: number;
  refs?: Map<unknown, number>;
  specials?: SpecialReferenceState;
}

export abstract class BaseParserContext implements PluginAccessOptions {
  abstract readonly mode: SerovalMode;

  features: number;

  marked = new Set<number>();

  refs: Map<unknown, number>;

  plugins?: Plugin<any, any>[] | undefined;

  specials: SpecialReferenceState;

  constructor(options: BaseParserContextOptions) {
    this.plugins = options.plugins;
    this.features = ALL_ENABLED ^ (options.disabledFeatures || 0);
    this.refs = options.refs || new Map<unknown, number>();
    this.specials = options.specials || createSpecialReferenceState();
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
}
