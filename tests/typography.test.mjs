import assert from 'node:assert/strict';
import vm from 'node:vm';
import {Blob} from 'node:buffer';
import {createEditor} from './harness.mjs';
const {env,els,run,element,source,errors}=await createEditor();
const sizes={qSize:39,aSize:27,winSize:65,loseSize:44,timeoutSize:57,resultBodySize:28,resultButtonSize:29};
for(const [id,value] of Object.entries(sizes)){assert.equal([...source.matchAll(new RegExp('id="'+id+'"','g'))].length,1,'One visible control for '+id);els.get(id).value=String(value);assert.equal(run('getCFGData().'+id),value);}
const game=run('getGameCode(true)');assert(game.includes('--q-size: 39px'));assert(game.includes('--a-size: 27px'));assert(game.includes('--result-body-size:28px'));assert(game.includes('--result-button-size:29px'));assert(game.includes('class="end-score-line"'));
assert(!game.includes('data:image/jpeg;base64,'),'Editor banner must never enter the preview or game export');assert(!game.includes('--studio-art'));assert(!game.includes('decoration'));
const gameCSS=game.match(/<style>([\s\S]*?)<\/style>/)[1];const resultTitleCSS=gameCSS.match(/#mt-end\{([^}]+)\}/)[1];assert(resultTitleCSS.includes('width:100%'));assert(resultTitleCSS.includes('max-width:none'));assert(resultTitleCSS.includes('text-align:center'));assert(!/text-shadow:(?!none)/.test(gameCSS),'No inherited text glow');
const script=[...game.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
const gameEls=new Map([...game.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],element('div',m[1])]));const noop=()=>{};gameEls.get('cvs').getContext=()=>({setTransform:noop,clearRect:noop,fillRect:noop});const styleVars={},handlers={};
const gameEnv={document:{getElementById:id=>gameEls.get(id),querySelectorAll:()=>[],createElement:tag=>element(tag),documentElement:{style:{setProperty:(k,v)=>styleVars[k]=v}}},parent:{},window:null,Image:class{},setTimeout:noop,setInterval:noop,clearInterval:noop,requestAnimationFrame:noop,console};gameEnv.window=gameEnv;gameEnv.addEventListener=(type,fn)=>handlers[type]=fn;vm.createContext(gameEnv);new vm.Script(script).runInContext(gameEnv);
const message=data=>handlers.message({source:gameEnv.parent,data});
for(const [scene,id] of [['win','winSize'],['lose','loseSize'],['timeout','timeoutSize']]){message({type:'PREVIEW_SCENE',scene});assert.equal(gameEls.get('mt-end').style.fontSize,sizes[id]+'px');els.get(id).value=String(sizes[id]+3);message({type:'LIVE_UPDATE',cfg:run('getCFGData()')});assert.equal(gameEls.get('mt-end').style.fontSize,sizes[id]+3+'px','Live edit updates the selected result scene');}
message({type:'PREVIEW_SCENE',scene:'tasks'});message({type:'LIVE_UPDATE',cfg:run('getCFGData()')});assert.equal(styleVars['--q-size'],'39px');assert.equal(styleVars['--a-size'],'27px');assert.equal(styleVars['--result-body-size'],'28px');assert.equal(styleVars['--result-button-size'],'29px');
let saved;env.download=data=>saved=data;run('saveProject()');const expected=run('getCFGData()');Object.keys(sizes).forEach(id=>els.get(id).value='12');await env.loadProject({files:[new Blob([saved])],value:''});for(const id of Object.keys(sizes))assert.equal(run('getCFGData().'+id),expected[id]);
const legacy=JSON.parse(saved);for(const id of ['winSize','loseSize','timeoutSize','resultBodySize','resultButtonSize'])delete legacy.settings[id];await env.loadProject({files:[new Blob([JSON.stringify(legacy)])],value:''});assert.equal(run('getCFGData().winSize'),42);assert.equal(run('getCFGData().loseSize'),38);
els.get('qSize').value='999';assert.equal(run('getCFGData().qSize'),120);els.get('aSize').value='-5';assert.equal(run('getCFGData().aSize'),12);assert.equal(errors.length,0);
console.log('PASS: seven visible typography controls, banner excluded from game screens, centered result heading layout, exact result heading sizes, live updates, question/answer sizes, body/button sizes, project round trip, legacy defaults, size bounds.');
