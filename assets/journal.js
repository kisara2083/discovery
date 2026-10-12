(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.DiscoveryIncremental=api;
  if(root.window===root&&typeof root.fetch==='function')api.installFetchShim(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION=1,MAX_FILE_BYTES=1250,MAX_REPLAY_FILES=2048;
  const enc=new TextEncoder(),dec=new TextDecoder();
  function bytesOf(text){return enc.encode(text);}
  function unb64url(text){
    const s=text.replace(/-/g,'+').replace(/_/g,'/');
    const padded=s+'='.repeat((4-s.length%4)%4);
    const binary=atob(padded),out=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);
    return out;
  }
  async function inflate(payload,DS=globalThis.DecompressionStream){
    if(typeof DS!=='function')throw Error('incremental_deflate_unavailable');
    const stream=new Blob([unb64url(payload)]).stream().pipeThrough(new DS('deflate'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  async function sha256hex(bytes,cryptoObj=globalThis.crypto){
    if(!cryptoObj||!cryptoObj.subtle)throw Error('incremental_crypto_unavailable');
    const digest=new Uint8Array(await cryptoObj.subtle.digest('SHA-256',bytes));
    return [...digest].map(v=>v.toString(16).padStart(2,'0')).join('');
  }
  function jstDate(value){
    if(typeof value!=='string')return null;
    if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value;
    const date=new Date(value);if(Number.isNaN(date.getTime()))return null;
    return new Date(date.getTime()+9*3600*1000).toISOString().slice(0,10);
  }
  function todayJst(now=new Date()){
    return new Date(now.getTime()+9*3600*1000).toISOString().slice(0,10);
  }
  function refreshLifecycle(article,today){
    const ends=[];
    for(const key of ['end_at','deadline_at']){const d=jstDate(article[key]);if(d)ends.push(d);}
    if(!article.end_at){const d=jstDate(article.event_date);if(d)ends.push(d);}
    article.lifecycle=ends.some(d=>d<today)?'ENDED':'ACTIVE';
    return article;
  }
  class Assembler{
    constructor(){this.parts=new Map();}
    async apply(record,cryptoObj=globalThis.crypto,DS=globalThis.DecompressionStream){
      if(!record||record.v!==VERSION||!/^[0-9a-f]{64}$/.test(record.h||''))throw Error('journal_record');
      if(record.t==='p'){
        const keys=Object.keys(record).sort().join(',');
        if(keys!=='d,h,i,n,t,v'||!Number.isInteger(record.i)||!Number.isInteger(record.n)||record.i<0||record.i>=record.n||typeof record.d!=='string')throw Error('journal_part');
        let slot=this.parts.get(record.h);if(!slot){slot={n:record.n,p:new Map()};this.parts.set(record.h,slot);}
        if(slot.n!==record.n)throw Error('journal_part_count');
        if(slot.p.has(record.i)&&slot.p.get(record.i)!==record.d)throw Error('journal_part_conflict');
        slot.p.set(record.i,record.d);return null;
      }
      if(record.t!=='c'||Object.keys(record).sort().join(',')!=='h,id,k,n,t,v'||!Number.isInteger(record.n)||typeof record.id!=='string'||typeof record.k!=='string')throw Error('journal_commit');
      const slot=this.parts.get(record.h);if(!slot||slot.n!==record.n||slot.p.size!==slot.n)return null;
      let payload='';for(let i=0;i<slot.n;i++){if(!slot.p.has(i))return null;payload+=slot.p.get(i);}
      const raw=await inflate(payload,DS);if(await sha256hex(raw,cryptoObj)!==record.h)throw Error('journal_digest');
      let doc;try{doc=JSON.parse(dec.decode(raw));}catch(_){throw Error('journal_json');}
      if(doc.k!==record.k||doc.id!==record.id||!Object.prototype.hasOwnProperty.call(doc,'v'))throw Error('journal_identity');
      return {kind:doc.k,id:doc.id,value:doc.v};
    }
  }
  async function readJson(fetchFn,url,maxBytes){
    const r=await fetchFn(url);if(!r.ok)return {missing:r.status===404,response:r};
    const text=await r.text();if(bytesOf(text).length>maxBytes)throw Error('journal_file_limit');
    return {value:JSON.parse(text),response:r};
  }
  async function overlay(base,fetchFn,opts={}){
    const headResult=await readJson(fetchFn,'data/journal/head.json?ts='+Date.now(),256);
    if(headResult.missing)return base;
    const head=headResult.value;
    if(!head||head.v!==VERSION||!Number.isInteger(head.b)||!Number.isInteger(head.s)||head.b<0||head.s<head.b||head.s-head.b>MAX_REPLAY_FILES)throw Error('journal_head');
    const articles=new Map((base.articles||[]).map(a=>[a.id,{...a}])),assembler=new Assembler();
    for(let seq=head.b+1;seq<=head.s;seq++){
      const name=String(seq).padStart(8,'0');
      const item=await readJson(fetchFn,'data/journal/'+name+'.json',MAX_FILE_BYTES);
      if(item.missing)throw Error('journal_gap');
      const doc=item.value;if(!doc||doc.v!==VERSION||!Array.isArray(doc.r))throw Error('journal_delta');
      for(const record of doc.r){
        const activated=await assembler.apply(record,opts.crypto,opts.DecompressionStream);
        if(activated){if(activated.kind!=='article'||!activated.value||activated.value.id!==activated.id)throw Error('journal_object');articles.set(activated.id,activated.value);}
      }
    }
    const today=todayJst(opts.now||new Date());
    const list=[...articles.values()].map(a=>refreshLifecycle({...a},today));
    // Match canonical exporter semantics: Python sort is stable and keys only on
    // updated_date. JS Array.sort is stable in modern engines, so do not add an
    // identity tie-break that could change TODAY'S PICK for same-date articles.
    list.sort((a,b)=>String(b.updated_date||'').localeCompare(String(a.updated_date||'')));
    const active=list.filter(a=>a.lifecycle!=='ENDED');
    return {...base,as_of:today,articles:list,todays_pick:active.length?active[0].id:null};
  }
  function installFetchShim(win){
    const nativeFetch=win.fetch.bind(win);
    win.discoveryIncrementalFetch=async function(url){
      const baseline=await nativeFetch(url);if(!baseline.ok)return baseline;
      const base=await baseline.json();
      try{
        const data=await overlay(base,(u)=>nativeFetch(u,{cache:u.includes('head.json')?'no-store':'force-cache'}),{crypto:win.crypto,DecompressionStream:win.DecompressionStream});
        return {ok:true,status:200,json:async()=>data};
      }catch(error){console.warn('DISCOVERY incremental overlay skipped',error);return {ok:true,status:200,json:async()=>base};}
    };
  }
  return {VERSION,MAX_FILE_BYTES,Assembler,overlay,installFetchShim,refreshLifecycle,todayJst};
});
