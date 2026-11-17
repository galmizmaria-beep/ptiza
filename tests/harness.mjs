import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {Blob,Buffer,atob,btoa} from 'node:buffer';
import {CompressionStream,DecompressionStream} from 'node:stream/web';
import {TextEncoder,TextDecoder} from 'node:util';
import {URL} from 'node:url';
class Response {
 constructor(body){this.body=body;}
 async arrayBuffer(){const reader=this.body.getReader(),chunks=[];let size=0;for(;;){const {done,value}=await reader.read();if(done)break;chunks.push(value);size+=value.length;}const all=new Uint8Array(size);let offset=0;for(const c of chunks){all.set(c,offset);offset+=c.length;}return all.buffer;}
 async text(){return new TextDecoder().decode(await this.arrayBuffer());}
}


export async function createEditor(){
const source=await fs.readFile(new URL('../index.html',import.meta.url),'utf8');
const scripts=[...source.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
function element(tag='div',id=''){
  return {tagName:tag.toUpperCase(),id,value:'',textContent:'',innerText:'',style:{},dataset:{},children:[],disabled:false,
    classList:{add(){},remove(){}},setAttribute(k,v){this[k]=v},appendChild(el){this.children.push(el);return el},replaceChildren(){this.children=[]},
    addEventListener(){},querySelectorAll(){return []},focus(){},select(){},click(){},remove(){},contentWindow:{postMessage(){}}};
}
const els=new Map();
for(const m of source.matchAll(/<(input|select|textarea|button|div|p|span|iframe)[^>]*\bid="([^"]+)"[^>]*>/g)){
 const el=element(m[1],m[2]);el.value=m[0].match(/\bvalue="([^"]*)"/)?.[1]||'';el.type=m[0].match(/\btype="([^"]*)"/)?.[1]||'';els.set(el.id,el);
}
for(const m of source.matchAll(/<select id="([^"]+)">([\s\S]*?)<\/select>/g)){
 const options=[...m[2].matchAll(/<option value="([^"]+)"([^>]*)>/g)];els.get(m[1]).value=(options.find(o=>o[2].includes('selected'))||options[0])[1];
}
const fields=[...els.values()].filter(el=>['INPUT','SELECT','TEXTAREA'].includes(el.tagName)&&el.type!=='file'&&!['finalCode'].includes(el.id));
const errors=[];
const document={getElementById:id=>{assert(els.has(id),'Missing editor element '+id);return els.get(id)},querySelectorAll:selector=>selector.startsWith('.left-panel')?fields:[],createElement:tag=>element(tag),documentElement:{style:{setProperty(){}}}};
const env={document,console,Blob,Response,CompressionStream,DecompressionStream,TextEncoder,Uint8Array,Uint8ClampedArray,atob,btoa,URL,Image:class{},navigator:{},setTimeout:()=>0,clearTimeout(){},alert:m=>errors.push(m)};env.window=env;
vm.createContext(env);for(const script of scripts)new vm.Script(script).runInContext(env);
const run=code=>vm.runInContext(code,env);
return {env,run,els,errors,element,source};
}
export {Response};
