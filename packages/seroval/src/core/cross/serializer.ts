import type {
  SerovalNode,
} from '../types';
import {
  GLOBAL_CONTEXT_REFERENCES,
} from '../keys';
import type { BaseSerializerContextOptions } from '../context/serializer';
import BaseSerializerContext from '../context/serializer';
import type { SerovalMode } from '../plugin';
import { serializeString } from '../string';
import type { CrossContextOptions } from './parser';

export interface CrossSerializerContextOptions
  extends BaseSerializerContextOptions, CrossContextOptions {
}

export default class CrossSerializerContext extends BaseSerializerContext {
  readonly mode: SerovalMode = 'cross';

  scopeId?: string;

  constructor(options: CrossSerializerContextOptions) {
    super(options);
    this.scopeId = options.scopeId;
  }

  getRefParam(id: number | string): string {
    if (typeof id === 'string') {
      return GLOBAL_CONTEXT_REFERENCES + '.' + id;
    }
    return GLOBAL_CONTEXT_REFERENCES + '[' + id + ']';
  }

  protected assignIndexedValue(
    index: number,
    value: string,
  ): string {
    return this.getRefParam(index) + '=' + value;
  }

  serializeTop(tree: SerovalNode): string {
    const result = this.serialize(tree);
    const id = tree.i;
    if (id == null) {
      return result;
    }
    const patches = this.resolvePatches();
    const ref = this.getRefParam(id);
    const params = this.scopeId == null ? '' : GLOBAL_CONTEXT_REFERENCES;
    const mainBody = patches ? result + ',' + patches : result;
    if (params === '') {
      return patches ? '(' + mainBody + ref + ')' : mainBody;
    }
    const args = this.scopeId == null ? '()' : '(' + GLOBAL_CONTEXT_REFERENCES + '["' + serializeString(this.scopeId) + '"])';
    const body = mainBody + (patches ? ref : '');
    return '(' + this.createFunction([params], body) + ')' + args;
  }
}
