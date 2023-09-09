// Used for mapping isomorphic references
export const REFERENCES_KEY = '__SEROVAL_REFS__';

export const GLOBAL_CONTEXT_REFERENCES = '$R';

export const LOCAL_CONTEXT_PROMISE_RESOLVE = 's';

export const LOCAL_CONTEXT_PROMISE_REJECT = 'f';

export const GLOBAL_CONTEXT_PROMISE_CONSTRUCTOR = '$P';

export const GLOBAL_CONTEXT_PROMISE_RESOLVE = '$Ps';

export const GLOBAL_CONTEXT_PROMISE_REJECT = '$Pf';

export const LOCAL_CONTEXT_STREAM_ENQUEUE = 'q';

export const LOCAL_CONTEXT_STREAM_CLOSE = 'c';

export const LOCAL_CONTEXT_STREAM_ERROR = 'e';

export const GLOBAL_CONTEXT_STREAM_CONSTRUCTOR = '$S';

export const GLOBAL_CONTEXT_STREAM_ENQUEUE = '$Sq';

export const GLOBAL_CONTEXT_STREAM_CLOSE = '$Sc';

export const GLOBAL_CONTEXT_STREAM_ERROR = '$Se';

export const ROOT_REFERENCE = 't';

const GLOBAL_HEADER = `function ${GLOBAL_CONTEXT_PROMISE_CONSTRUCTOR}(s,f,p){return p=(new Promise(function(a,b){s=a,f=b})),p.${LOCAL_CONTEXT_PROMISE_RESOLVE}=s,p.${LOCAL_CONTEXT_PROMISE_REJECT}=f,p}
function $uP(p){delete p.${LOCAL_CONTEXT_PROMISE_RESOLVE};delete p.${LOCAL_CONTEXT_PROMISE_REJECT}}
function ${GLOBAL_CONTEXT_PROMISE_RESOLVE}(i,d){$R[i].${LOCAL_CONTEXT_PROMISE_RESOLVE}(d);$uP($R[i])}
function ${GLOBAL_CONTEXT_PROMISE_REJECT}(i,d){$R[i].${LOCAL_CONTEXT_PROMISE_REJECT}(d);$uP($R[i])}
function ${GLOBAL_CONTEXT_STREAM_CONSTRUCTOR}(n,e,t){function u(n,e){switch(e[0]){case 0:return n.enqueue(e[1]);case 1:return n.error(e[1]);case 2:return n.close()}}function r(t,u,r,c){for(n.push([t,u]),r=0,c=e.length;r<c;r++)e[r]([t,u])}return n=[],e=[],(t=new ReadableStream({start:function(t){!function(e,t,r){for(t=0,r=n.length;t<r;t++)u(e,n[t])}(t),e.push((function(n){u(t,n)}))}})).${LOCAL_CONTEXT_STREAM_ENQUEUE}=function(n){r(0,n)},t.${LOCAL_CONTEXT_STREAM_ERROR}=function(n){r(1,n)},t.${LOCAL_CONTEXT_STREAM_CLOSE}=function(n){r(2);delete t.${LOCAL_CONTEXT_STREAM_ENQUEUE};delete t.${LOCAL_CONTEXT_STREAM_ERROR};delete t.${LOCAL_CONTEXT_STREAM_CLOSE}},t}
function ${GLOBAL_CONTEXT_STREAM_ENQUEUE}(i,d){$R[i].${LOCAL_CONTEXT_STREAM_ENQUEUE}(d)}
function ${GLOBAL_CONTEXT_STREAM_ERROR}(i,d){$R[i].${LOCAL_CONTEXT_STREAM_ERROR}(d)}
function ${GLOBAL_CONTEXT_STREAM_CLOSE}(i){$R[i].${LOCAL_CONTEXT_STREAM_CLOSE}()}
`;

export function getCrossReferenceHeader(): string {
  return `${GLOBAL_CONTEXT_REFERENCES}=[];${GLOBAL_HEADER}`;
}
