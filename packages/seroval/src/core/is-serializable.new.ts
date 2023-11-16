import { ALL_ENABLED, BIGINT_FLAG, Feature } from './compat';
import { INV_SYMBOL_REF, UNIVERSAL_SENTINEL } from './constants';
import type { Plugin, PluginAccessOptions } from './plugin';
import { hasReferenceID } from './reference';
import { getErrorOptions } from './utils/error';

export type SerializationMode = 'sync' | 'async' | 'stream';

export interface IsSerializableOptions extends PluginAccessOptions {
  mode: SerializationMode;
  disabledFeatures?: number;
}

class IsSerializableContext implements PluginAccessOptions {
  plugins?: Plugin<any, any>[] | undefined;

  mode: SerializationMode;

  features: number;

  constructor(options: IsSerializableOptions) {
    this.mode = options.mode;
    this.plugins = options.plugins;
    this.features = ALL_ENABLED ^ (options.disabledFeatures || 0);
  }

  checkArray(values: unknown[]): boolean {
    if (!this.check(values[0])) {
      return false;
    }
    for (let i = 1, len = values.length; i < len; i++) {
      if (!this.check(values[i])) {
        return false;
      }
    }
    return true;
  }

  checkPlainObject(value: object): boolean {
    return this.checkArray(Object.values(value));
  }

  checkError(value: Error): boolean {
    const options = getErrorOptions(value, this.features);
    if (options) {
      return this.checkPlainObject(options);
    }
    return true;
  }

  checkPlugin(value: unknown): boolean {
    const current = this.plugins;
    if (current) {
      for (let i = 0, len = current.length; i < len; i++) {
        const plugin = current[i];
        if (plugin.test(value) && plugin.isSerializable && plugin.isSerializable(value)) {
          return true;
        }
      }
    }
    return true;
  }

  checkObject(value: object | null): boolean {
    if (!value) {
      return true;
    }
    if (Array.isArray(value)) {
      return this.checkArray(value);
    }
    const currentClass = value.constructor;
    switch (currentClass) {
      case Date:
      case RegExp:
      case Number:
      case Boolean:
      case String:
      case BigInt:
        return true;
      case Object:
      case undefined:
        return this.checkPlainObject(value);
      case Error:
      case EvalError:
      case RangeError:
      case ReferenceError:
      case SyntaxError:
      case TypeError:
      case URIError:
        return this.checkError(value as unknown as Error);
      default:
        break;
    }
    const currentFeatures = this.features;
    // Promises
    if (
      (currentFeatures & Feature.Promise)
      && (currentClass === Promise || value instanceof Promise)
    ) {
      return this.mode === 'async' || this.mode === 'stream';
    }
    // Typed Arrays
    if (currentFeatures & Feature.TypedArray) {
      switch (currentClass) {
        case ArrayBuffer:
        case Int8Array:
        case Int16Array:
        case Int32Array:
        case Uint8Array:
        case Uint16Array:
        case Uint32Array:
        case Uint8ClampedArray:
        case Float32Array:
        case Float64Array:
        case DataView:
          return true;
        default:
          break;
      }
    }
    // BigInt Typed Arrays
    if ((currentFeatures & BIGINT_FLAG) === BIGINT_FLAG) {
      switch (currentClass) {
        case BigInt64Array:
        case BigUint64Array:
          return true;
        default:
          break;
      }
    }
    // ES Collection
    if (currentFeatures & Feature.Map && currentClass === Map) {
      return true;
    }
    if (currentFeatures & Feature.Set && currentClass === Set) {
      return true;
    }
    // Web APIs
    if (currentFeatures & Feature.WebAPI) {
      switch (currentClass) {
        case (typeof URL !== 'undefined' ? URL : UNIVERSAL_SENTINEL):
        case (typeof URLSearchParams !== 'undefined' ? URLSearchParams : UNIVERSAL_SENTINEL):
        case (typeof Headers !== 'undefined' ? Headers : UNIVERSAL_SENTINEL):
        case (typeof FormData !== 'undefined' ? FormData : UNIVERSAL_SENTINEL):
        case (typeof Event !== 'undefined' ? Event : UNIVERSAL_SENTINEL):
        case (typeof CustomEvent !== 'undefined' ? CustomEvent : UNIVERSAL_SENTINEL):
        case (typeof DOMException !== 'undefined' ? DOMException : UNIVERSAL_SENTINEL):
          return true;
        case (typeof Request !== 'undefined' ? Request : UNIVERSAL_SENTINEL):
        case (typeof Response !== 'undefined' ? Response : UNIVERSAL_SENTINEL):
          return this.mode === 'async' || this.mode === 'stream';
        case (typeof Blob !== 'undefined' ? Blob : UNIVERSAL_SENTINEL):
        case (typeof File !== 'undefined' ? File : UNIVERSAL_SENTINEL):
          return this.mode === 'async';
        case (typeof ReadableStream !== 'undefined' ? ReadableStream : UNIVERSAL_SENTINEL):
          return this.mode === 'stream';
        default:
          break;
      }
    }
    const parsed = this.checkPlugin(value);
    if (parsed) {
      return parsed;
    }
    if (
      (currentFeatures & Feature.AggregateError)
      && typeof AggregateError !== 'undefined'
      && (currentClass === AggregateError || value instanceof AggregateError)
    ) {
      return true;
    }
    // Slow path. We only need to handle Errors and Iterators
    // since they have very broad implementations.
    if (value instanceof Error) {
      return true;
    }
    // Generator functions don't have a global constructor
    // despite existing
    if (currentFeatures & Feature.Symbol && Symbol.iterator in value) {
      return true;
    }
    return false;
  }

  check(value: unknown): boolean {
    switch (typeof value) {
      case 'string':
      case 'number':
      case 'boolean':
      case 'undefined':
        return true;
      case 'bigint':
        return !!(this.features & Feature.BigInt);
      case 'object':
        return this.checkObject(value);
      case 'symbol':
        return !!(this.features & Feature.Symbol) && value in INV_SYMBOL_REF;
      case 'function':
        return hasReferenceID(value);
      default:
        return false;
    }
  }
}

export function isSerializable<T>(value: T, options: IsSerializableOptions): boolean {
  return new IsSerializableContext(options).check(value);
}
