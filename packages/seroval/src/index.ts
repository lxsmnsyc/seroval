import { serialize } from './core/tree';

export { Feature } from './core/compat';
export { createReference } from './core/reference';

export * from './core/tree';
export * from './core/cross';

export { getCrossReferenceHeader } from './core/keys';

export { default as Serializer } from './core/Serializer';
export * from './core/plugin';

export type { Stream } from './core/stream';
export { createStream, streamToAsyncIterable } from './core/stream';

export type { SerovalNode } from './core/types';

export default serialize;
