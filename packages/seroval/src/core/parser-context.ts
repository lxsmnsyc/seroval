import { createIndexedValueNode, createReferenceNode } from './base-primitives';
import { ALL_ENABLED, BIGINT_FLAG, Feature } from './compat';
import { ERROR_CONSTRUCTOR_STRING } from './constants';
import type { Plugin, PluginAccessOptions, SerovalMode } from './plugin';
import { hasReferenceID } from './reference';
import { getErrorConstructor } from './shared';
import type { SerovalIndexedValueNode, SerovalReferenceNode } from './types';

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

  /**
   * @private
   */
  protected getErrorOptions(
    error: Error,
  ): Record<string, unknown> | undefined {
    let options: Record<string, unknown> | undefined;
    const constructor = ERROR_CONSTRUCTOR_STRING[getErrorConstructor(error)];
    // Name has been modified
    if (error.name !== constructor) {
      options = { name: error.name };
    } else if (error.constructor.name !== constructor) {
      // Otherwise, name is overriden because
      // the Error class is extended
      options = { name: error.constructor.name };
    }
    const names = Object.getOwnPropertyNames(error);
    for (let i = 0, len = names.length, name: string; i < len; i++) {
      name = names[i];
      if (name !== 'name' && name !== 'message') {
        if (name === 'stack') {
          if (this.features & Feature.ErrorPrototypeStack) {
            options = options || {};
            options[name] = error[name as keyof Error];
          }
        } else {
          options = options || {};
          options[name] = error[name as keyof Error];
        }
      }
    }
    return options;
  }

  /**
   * @private
   */
  protected isIterable(
    value: unknown,
  ): value is Iterable<unknown> {
    if (!value || typeof value !== 'object') {
      return false;
    }
    if (Array.isArray(value)) {
      return false;
    }
    const currentClass = value.constructor;
    if (this.features & Feature.TypedArray) {
      switch (currentClass) {
        case Int8Array:
        case Int16Array:
        case Int32Array:
        case Uint8Array:
        case Uint16Array:
        case Uint32Array:
        case Uint8ClampedArray:
        case Float32Array:
        case Float64Array:
          return false;
        default:
          break;
      }
    }
    // BigInt Typed Arrays
    if ((this.features & BIGINT_FLAG) === BIGINT_FLAG) {
      switch (currentClass) {
        case BigInt64Array:
        case BigUint64Array:
          return false;
        default:
          break;
      }
    }
    // ES Collection
    if (this.features & Feature.Map && currentClass === Map) {
      return false;
    }
    if (this.features & Feature.Set && currentClass === Set) {
      return false;
    }
    if (this.features & Feature.WebAPI) {
      switch (currentClass) {
        case Headers:
        case File:
          return false;
        default:
          break;
      }
    }
    if (this.plugins) {
      for (let i = 0, len = this.plugins.length; i < len; i++) {
        const plugin = this.plugins[i];
        if (plugin.test(value) && plugin.isIterable && plugin.isIterable(value)) {
          return false;
        }
      }
    }
    if (this.features & Feature.Symbol) {
      return Symbol.iterator in value;
    }
    return false;
  }
}
