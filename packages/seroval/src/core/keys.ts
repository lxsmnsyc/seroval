import { serializeString } from './string';

// Used for mapping isomorphic references
export const REFERENCES_KEY = '__SEROVAL_REFS__';

export const GLOBAL_CONTEXT_API = '_$';

export const GLOBAL_CONTEXT_REFERENCES = '$R';

export const LOCAL_CONTEXT_PROMISE_RESOLVE = 's';

export const LOCAL_CONTEXT_PROMISE_REJECT = 'f';

export const GLOBAL_CONTEXT_PROMISE_CONSTRUCTOR = 'P';

export const GLOBAL_CONTEXT_PROMISE_RESOLVE = 'Ps';

export const GLOBAL_CONTEXT_PROMISE_REJECT = 'Pf';

export const LOCAL_CONTEXT_STREAM_CONTROLLER = 'c';

export const GLOBAL_CONTEXT_STREAM_CONSTRUCTOR = 'S';

export const GLOBAL_CONTEXT_STREAM_EMIT = 'Se';

export const GLOBAL_CONTEXT_API_SCRIPT = `self.${GLOBAL_CONTEXT_API}=self.${GLOBAL_CONTEXT_API}||{`
  + `${GLOBAL_CONTEXT_PROMISE_CONSTRUCTOR}:function(s,f,p){return(p=new Promise(function(a,b){s=a,f=b})).${LOCAL_CONTEXT_PROMISE_RESOLVE}=s,p.${LOCAL_CONTEXT_PROMISE_REJECT}=f,p},`
  + `uP:function(p){delete p.${LOCAL_CONTEXT_PROMISE_RESOLVE};delete p.${LOCAL_CONTEXT_PROMISE_REJECT}},`
  + `${GLOBAL_CONTEXT_PROMISE_RESOLVE}:function(p,d){p.${LOCAL_CONTEXT_PROMISE_RESOLVE}(d),p.value=d,this.uP(p)},`
  + `${GLOBAL_CONTEXT_PROMISE_REJECT}:function(p,d){p.${LOCAL_CONTEXT_PROMISE_REJECT}(d),this.uP(p)},`
  + `uS:function(s){delete s.${LOCAL_CONTEXT_STREAM_CONTROLLER}},`
  + `${GLOBAL_CONTEXT_STREAM_EMIT}:function(s,t,d,c){switch(c=s.${LOCAL_CONTEXT_STREAM_CONTROLLER},t){case 0:return c.enqueue(d);case 1:return(this.uS(s),c.error(d));case 2:return(this.uS(s),c.close())}},`
  + `${GLOBAL_CONTEXT_STREAM_CONSTRUCTOR}:function(s,c){return(s=new ReadableStream({start:function(x){c=x}})).${LOCAL_CONTEXT_STREAM_CONTROLLER}=c,s}`
  + '}';

export function getCrossReferenceHeader(id?: string): string {
  if (id == null) {
    return `self.${GLOBAL_CONTEXT_REFERENCES}=self.${GLOBAL_CONTEXT_REFERENCES}||[];`;
  }
  return `(self.${GLOBAL_CONTEXT_REFERENCES}=self.${GLOBAL_CONTEXT_REFERENCES}||{})["${serializeString(id)}"]=[]`;
}
