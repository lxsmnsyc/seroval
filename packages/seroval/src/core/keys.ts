// Used for mapping isomorphic references
export const REFERENCES_KEY = '__SEROVAL_REFS__';

export const GLOBAL_CONTEXT_REFERENCES = '$R';

export const LOCAL_CONTEXT_PROMISE_RESOLVE = 's';

export const LOCAL_CONTEXT_PROMISE_REJECT = 'f';

export const GLOBAL_CONTEXT_PROMISE_CONSTRUCTOR = '$P';

export const GLOBAL_CONTEXT_PROMISE_RESOLVE = '$Ps';

export const GLOBAL_CONTEXT_PROMISE_REJECT = '$Pf';

export const LOCAL_CONTEXT_STREAM_CONTROLLER = 'c';

export const GLOBAL_CONTEXT_STREAM_CONSTRUCTOR = '$S';

export const GLOBAL_CONTEXT_STREAM_EMIT = '$Se';

export const ROOT_REFERENCE = 't';

export const CROSS_REFERENCE_HEADER = `
var ${GLOBAL_CONTEXT_REFERENCES}=[];
function ${GLOBAL_CONTEXT_PROMISE_CONSTRUCTOR}(s,f,p){return (p=new Promise(function(a,b){s=a,f=b})).${LOCAL_CONTEXT_PROMISE_RESOLVE}=s,p.${LOCAL_CONTEXT_PROMISE_REJECT}=f,p}
function $uP(i,p){delete (p=${GLOBAL_CONTEXT_REFERENCES}[i]).${LOCAL_CONTEXT_PROMISE_RESOLVE};delete p.${LOCAL_CONTEXT_PROMISE_REJECT}}
function ${GLOBAL_CONTEXT_PROMISE_RESOLVE}(i,d){${GLOBAL_CONTEXT_REFERENCES}[i].${LOCAL_CONTEXT_PROMISE_RESOLVE}(d),$uP(i)}
function ${GLOBAL_CONTEXT_PROMISE_REJECT}(i,d){${GLOBAL_CONTEXT_REFERENCES}[i].${LOCAL_CONTEXT_PROMISE_REJECT}(d),$uP(i)}
function $uS(s){delete s.${LOCAL_CONTEXT_STREAM_CONTROLLER}}
function ${GLOBAL_CONTEXT_STREAM_EMIT}(i,t,d,s,c){switch(c=(s=${GLOBAL_CONTEXT_REFERENCES}[i]).${LOCAL_CONTEXT_STREAM_CONTROLLER},t){case 0:return c.enqueue(d);case 1:return c.error(d),$uS(s);case 2:return c.close(),$uS(s)}}
function ${GLOBAL_CONTEXT_STREAM_CONSTRUCTOR}(s,c){return(s=new ReadableStream({start:function(t){c=t}})).c=c,s}
`;
