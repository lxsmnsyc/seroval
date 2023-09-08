import { Feature } from './compat';

// Used for mapping isomorphic references
export const REFERENCES_KEY = '__SEROVAL_REFS__';

export const GLOBAL_CONTEXT_KEY = '__SEROVAL__';

export const GLOBAL_CONTEXT_REFERENCES = 'r';

export const GLOBAL_CONTEXT_RESOLVERS = 's';

export const GLOBAL_CONTEXT_REJECTERS = 'f';

export const GLOBAL_CONTEXT_PROMISE_CONSTRUCTOR = 'p';

export const ROOT_REFERENCE = 't';

export const GLOBAL_CONTEXT_PARAM = 'o';

const GLOBAL_CONTEXT_PROMISE_CONSTRUCTOR_FUNCTION_BODY = `(s,f,p){return p=new Promise(function(a,b){s=a,f=b}),p.${GLOBAL_CONTEXT_RESOLVERS}=s,p.${GLOBAL_CONTEXT_REJECTERS}=f,p}`;
const GLOBAL_CONTEXT_PROMISE_CONSTRUCTOR_ARROW_BODY = `(s,f,p)=>(p=new Promise((a,b)=>{s=a,f=b}),p.${GLOBAL_CONTEXT_RESOLVERS}=s,p.${GLOBAL_CONTEXT_REJECTERS}=f,p)`;

function getPromiseConstructor(features: number): string {
  if (features & Feature.ArrowFunction) {
    return `${GLOBAL_CONTEXT_PROMISE_CONSTRUCTOR}:${GLOBAL_CONTEXT_PROMISE_CONSTRUCTOR_ARROW_BODY}`;
  }
  if (features & Feature.MethodShorthand) {
    return `${GLOBAL_CONTEXT_PROMISE_CONSTRUCTOR}${GLOBAL_CONTEXT_PROMISE_CONSTRUCTOR_FUNCTION_BODY}`;
  }
  return `${GLOBAL_CONTEXT_PROMISE_CONSTRUCTOR}:function${GLOBAL_CONTEXT_PROMISE_CONSTRUCTOR_FUNCTION_BODY}`;
}

export function getCrossReferenceHeader(features: number): string {
  return `${GLOBAL_CONTEXT_KEY}={${GLOBAL_CONTEXT_REFERENCES}:[],${getPromiseConstructor(features)}};`;
}
