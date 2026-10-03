import { serializeString } from './string';

// Used for mapping isomorphic references
export const REFERENCES_KEY = '__SEROVAL_REFS__';

export const GLOBAL_CONTEXT_REFERENCES = '$R';

const GLOBAL_CONTEXT_R = `self.${GLOBAL_CONTEXT_REFERENCES}`;

/**
 * Returns the JavaScript snippet that initializes the shared cross-reference
 * table (`self.$R`) which {@link crossSerialize} and {@link crossSerializeStream}
 * output depends on. Emit it once on the target realm before evaluating any
 * cross-serialized chunk.
 *
 * @param id When given, scopes the table to that id (`scopeId`); otherwise a
 * single global table is used. The id is escaped before being embedded.
 */
export function getCrossReferenceHeader(id?: string): string {
  if (id == null) {
    return `${GLOBAL_CONTEXT_R}=${GLOBAL_CONTEXT_R}||[]`;
  }
  return `(${GLOBAL_CONTEXT_R}=${GLOBAL_CONTEXT_R}||{})["${serializeString(
    id,
  )}"]=[]`;
}
