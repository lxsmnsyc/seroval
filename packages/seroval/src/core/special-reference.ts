import { createEffectfulFunction, createFunction } from './function-string';

export const ITERATOR = {};

export const ASYNC_ITERATOR = {};

export const enum SpecialReference {
  MapSentinel = 0,
  PromiseConstructor = 1,
  PromiseSuccess = 2,
  PromiseFailure = 3,
  StreamConstructor = 4,
}

/**
 * Placeholder references
 */
export const SPECIAL_REFS: Record<SpecialReference, unknown> = {
  [SpecialReference.MapSentinel]: {},
  [SpecialReference.PromiseConstructor]: {},
  [SpecialReference.PromiseSuccess]: {},
  [SpecialReference.PromiseFailure]: {},
  [SpecialReference.StreamConstructor]: {},
};

function serializePromiseConstructor(features: number): string {
  return createFunction(
    features,
    ['r'],
    '(r.p=new Promise(' +
      createEffectfulFunction(features, ['s', 'f'], 'r.s=s,r.f=f') +
      '))',
  );
}

function serializePromiseSuccess(features: number): string {
  return createEffectfulFunction(
    features,
    ['r', 'd'],
    'r.s(d),r.p.s=1,r.p.v=d',
  );
}

function serializePromiseFailure(features: number): string {
  return createEffectfulFunction(
    features,
    ['r', 'd'],
    'r.f(d),r.p.s=2,r.p.v=d',
  );
}

function serializeStreamConstructor(features: number): string {
  return createFunction(
    features,
    ['b', 'a', 's', 'l', 'p', 'f', 'e', 'n'],
    '(b=[],a=!0,s=!1,l=[],p=0,f=' +
      createEffectfulFunction(
        features,
        ['v', 'm', 'x'],
        'for(x=0;x<p;x++)l[x]&&l[x][m](v)',
      ) +
      ',n=' +
      createEffectfulFunction(
        features,
        ['o', 'x', 'z', 'c'],
        'for(x=0,z=b.length;x<z;x++)(c=b[x],(!a&&x===z-1)?o[s?"return":"throw"](c):o.next(c))',
      ) +
      ',e=' +
      createFunction(
        features,
        ['o', 't'],
        '(a&&(l[t=p++]=o),n(o),' +
          createEffectfulFunction(features, [], 'a&&(l[t]=void 0)') +
          ')',
      ) +
      ',{__SEROVAL_STREAM__:!0,on:' +
      createFunction(features, ['o'], 'e(o)') +
      ',next:' +
      createEffectfulFunction(features, ['v'], 'a&&(b.push(v),f(v,"next"))') +
      ',throw:' +
      createEffectfulFunction(
        features,
        ['v'],
        'a&&(b.push(v),f(v,"throw"),a=s=!1,l.length=0)',
      ) +
      ',return:' +
      createEffectfulFunction(
        features,
        ['v'],
        'a&&(b.push(v),f(v,"return"),a=!1,s=!0,l.length=0)',
      ) +
      '})',
  );
}

export function serializeSpecialReferenceValue(
  features: number,
  ref: SpecialReference,
): string {
  switch (ref) {
    case SpecialReference.MapSentinel:
      return '[]';
    case SpecialReference.PromiseConstructor:
      return serializePromiseConstructor(features);
    case SpecialReference.PromiseSuccess:
      return serializePromiseSuccess(features);
    case SpecialReference.PromiseFailure:
      return serializePromiseFailure(features);
    case SpecialReference.StreamConstructor:
      return serializeStreamConstructor(features);
    default:
      return '';
  }
}
