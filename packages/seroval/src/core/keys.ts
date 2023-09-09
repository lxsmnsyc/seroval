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

export const CROSS_REFERENCE_HEADER = `
${GLOBAL_CONTEXT_REFERENCES}=[];
function ${GLOBAL_CONTEXT_PROMISE_CONSTRUCTOR}(s,f,p){return (p=new Promise(function(a,b){s=a,f=b})).${LOCAL_CONTEXT_PROMISE_RESOLVE}=s,p.${LOCAL_CONTEXT_PROMISE_REJECT}=f,p}
function $uP(i,p){delete (p=${GLOBAL_CONTEXT_REFERENCES}[i]).${LOCAL_CONTEXT_PROMISE_RESOLVE};delete p.${LOCAL_CONTEXT_PROMISE_REJECT}}
function $Ps(i,d){${GLOBAL_CONTEXT_REFERENCES}[i].${LOCAL_CONTEXT_PROMISE_RESOLVE}(d),$uP(i)}
function $Pf(i,d){${GLOBAL_CONTEXT_REFERENCES}[i].${LOCAL_CONTEXT_PROMISE_REJECT}(d),$uP(i)}
function $uS(s){delete s.${LOCAL_CONTEXT_STREAM_ENQUEUE};delete s.${LOCAL_CONTEXT_STREAM_ERROR};delete s.${LOCAL_CONTEXT_STREAM_CLOSE}}
function $iS(c,d){switch(d[0]){case 0:return c.enqueue(d[1]);case 1:return c.error(d[1]);case 2:return c.close()}}
function $wS(b,l,t,d,i,k){for(b.push([t,d]),i=0,k=l.length;i<k;i++)l[i]([t,d])}
function $fS(b,c,i,k){for(i=0,k=b.length;i<k;i++)$iS(c,b[i])}
function $S(b,l,s){return b=[],l=[],(s=new ReadableStream({start:function(c){$fS(b,c),l.push(function(d){$iS(c,d)})}})).q=function(d){$wS(b,l,0,d)},s.e=function(d){$wS(b,l,1,d),$uS(s)},s.c=function(){$wS(b,l,2),$uS(s)},s}
function $Sq(i,d){$R[i].q(d)}
function $Se(i,d){$R[i].e(d)}
function $Sc(i){$R[i].c()}
`;
