// Used for mapping isomorphic references
export const REFERENCES_KEY = '__SEROVAL_REFS__';

export const GLOBAL_CONTEXT_REFERENCES = '$R';

export const GLOBAL_CONTEXT_RESOLVE = 's';

export const GLOBAL_CONTEXT_REJECT = 'f';

export const GLOBAL_CONTEXT_PROMISE_CONSTRUCTOR = '$P';

export const ROOT_REFERENCE = 't';

const GLOBAL_CONTEXT_PROMISE_CONSTRUCTOR_FUNCTION_BODY = `(s,f,p){return p=new Promise(function(a,b){s=a,f=b}),p.${GLOBAL_CONTEXT_RESOLVE}=s,p.${GLOBAL_CONTEXT_REJECT}=f,p}`;

function getPromiseConstructor(): string {
  return `function ${GLOBAL_CONTEXT_PROMISE_CONSTRUCTOR}${GLOBAL_CONTEXT_PROMISE_CONSTRUCTOR_FUNCTION_BODY}`;
}

export function getCrossReferenceHeader(): string {
  return `${GLOBAL_CONTEXT_REFERENCES}=[];${getPromiseConstructor()};`;
}
