export { Feature } from './core/compat';
export type {
  BaseSerializerContextOptions,
  CrossSerializerContextOptions,
  SerializePluginContext,
  VanillaSerializerContextOptions,
} from './core/context/serializer';
export type {
} from './core/context/parser';
export * from './core/cross';
export * from './core/errors';
export { getCrossReferenceHeader } from './core/keys';
export { OpaqueReference } from './core/opaque-reference';
export * from './core/plugin';
export { createReference } from './core/reference';
export { default as Serializer } from './core/Serializer';
export { createStream } from './core/stream';
export type { Stream, StreamListener } from './core/stream';
export * from './core/tree';
export type { SerovalNode } from './core/types';
