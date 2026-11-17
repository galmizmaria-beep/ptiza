import assert from 'node:assert/strict';
import vm from 'node:vm';
import {Blob} from 'node:buffer';
import {createEditor} from './harness.mjs';
const {env,els,run,element,errors}=await createEditor();
const languageKeys=['val_title','val_start','val_win','val_lose','val_timeout','val_avatar','val_creature','btn_try_again','score_lbl','oral_hint','sample','assess','correct','again','up','down','check_order','your_answer','submit'];
for(const lang of ['ru','en','de','fr','es','it','pt','tr','zh','ja','ar']){
 env.langToTest=lang;run('setLang(langToTest)');const cfg=run('getCFGData()');assert.equal(cfg.lang.lang,lang);assert(languageKeys.every(k=>typeof cfg.lang.dict[k]==='string'&&cfg.lang.dict[k]));assert.equal(cfg.timeout,run('dict[currentLang].val_timeout'));assert(run('getGameCode()').includes('lang="'+lang+'"'));
}
run("setLang('ru')");
const field=els.get('bulkQuestions');field.value='[ввод] Один | 1\n[устно] Два | 2';
// Preview choice is restored when assets trigger a full iframe reload.
run("selectPreviewScene('tasks')");els.get('previewQuestion').value='1';run('fullRestart()');assert.equal(run('previewScene'),'tasks');assert(els.get('gamePreview').srcdoc.includes('"previewScene":"tasks"'));assert(els.get('gamePreview').srcdoc.includes('"previewQuestion":1'));
assert(!run('getGameCode()').includes('"editorPreview":true'),'Export opens as a game, not in editor mode');
els.get('useFrame').checked=false;assert.equal(run('getCFGData().frame_img'),'');els.get('useTimer').checked=false;assert.equal(run('getCFGData().timerEnabled'),false);
let saved;env.download=d=>saved=d;run('saveProject()');els.get('useFrame').checked=true;els.get('useTimer').checked=true;await env.loadProject({files:[new Blob([saved])],value:''});assert.equal(els.get('useFrame').checked,false);assert.equal(els.get('useTimer').checked,false);
const legacy=JSON.parse(saved);delete legacy.settings.useFrame;delete legacy.settings.useTimer;await env.loadProject({files:[new Blob([JSON.stringify(legacy)])],value:''});assert.equal(els.get('useFrame').checked,true);assert.equal(els.get('useTimer').checked,true);assert.equal(errors.length,0);
const game=run('getGameCode(true)'),script=[...game.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
const gameEls=new Map([...game.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],element('div',m[1])]));
const noop=()=>{};const ctx={clearRect:noop,fillRect:noop,drawImage:noop,save:noop,restore:noop,beginPath:noop,moveTo:noop,lineTo:noop,closePath:noop,fill:noop,arc:noop,translate:noop,rotate:noop};gameEls.get('cvs').getContext=()=>ctx;
const handlers={},timers=[];const styleVars={};const gameEnv={document:{getElementById:id=>{assert(gameEls.has(id),'Missing game element '+id);return gameEls.get(id)},querySelectorAll:()=>[],createElement:tag=>element(tag),documentElement:{style:{setProperty:(k,v)=>styleVars[k]=v}}},parent:{},window:null,Image:class{},setTimeout:noop,setInterval:fn=>{timers.push(fn);return timers.length},clearInterval:noop,requestAnimationFrame:noop,console,innerWidth:1000,innerHeight:700};gameEnv.window=gameEnv;gameEnv.addEventListener=(type,fn)=>handlers[type]=fn;vm.createContext(gameEnv);new vm.Script(script).runInContext(gameEnv);const gr=code=>vm.runInContext(code,gameEnv);gr('sfx=()=>{};resize()');
const message=data=>handlers.message({source:gameEnv.parent,data});
for(const scene of ['title','game','tasks','win','lose','timeout']){message({type:'PREVIEW_SCENE',scene,question:0});assert.equal(gr('editorScene'),scene);assert.equal(gr('GM.run'),false);if(scene==='tasks')assert.equal(gameEls.get('quiz-box').style.display,'block');}
assert.equal(gameEls.get('mt-end').innerText,els.get('txtTimeout').value);
let cfg=run('getCFGData()');cfg.win='Новая победа';message({type:'PREVIEW_SCENE',scene:'win'});message({type:'LIVE_UPDATE',cfg});assert.equal(gameEls.get('mt-end').innerText,'Новая победа');assert.equal(gr('editorScene'),'win');
cfg.lose='Новое поражение';message({type:'PREVIEW_SCENE',scene:'lose'});message({type:'LIVE_UPDATE',cfg});assert.equal(gameEls.get('mt-end').innerText,'Новое поражение');
run("setLang('ar')");cfg=run('getCFGData()');message({type:'PREVIEW_SCENE',scene:'tasks',question:1});message({type:'LIVE_UPDATE',cfg});assert.equal(gameEnv.document.documentElement.dir,'rtl');assert.equal(gameEls.get('q-body').children[1].textContent,cfg.lang.dict.sample);assert.equal(gameEls.get('q-txt').textContent,'Два','User questions are preserved');
// Untimed mode hides the HUD and has no second penalties, including wrong answers.
cfg.timerEnabled=false;cfg.useFrame=false;cfg.frame_img='';message({type:'LIVE_UPDATE',cfg});assert.equal(gameEls.get('hud-time').style.display,'none');assert.equal(styleVars['--selection-frame'],'none');gr('GM.time=5;quiz(0)');gameEls.get('q-body').children[0].value='wrong';gameEls.get('q-body').children[1].onclick({stopPropagation(){}});assert.equal(gr('GM.time'),5);
// Timed wrong answers can end specifically in timeout, distinct from losing all coins.
cfg.timerEnabled=true;message({type:'LIVE_UPDATE',cfg});gr('GM.run=true;GM.time=5;quiz(0)');gameEls.get('q-body').children[0].value='wrong';gameEls.get('q-body').children[1].onclick({stopPropagation(){}});assert.equal(gameEls.get('mt-end').innerText,cfg.timeout);
// Other windows cannot control preview scene or settings.
handlers.message({source:{},data:{type:'PREVIEW_SCENE',scene:'title'}});assert.equal(gr('editorScene'),'tasks');
// Timer ticks obey the checkbox during an actual test run.
message({type:'PREVIEW_SCENE',scene:'play'});cfg.timerEnabled=false;message({type:'LIVE_UPDATE',cfg});gr('selectedAvatar="avatar";selectedCreature="creature";GM.start();GM.time=3');timers.at(-1)();assert.equal(gr('GM.time'),3);cfg.timerEnabled=true;message({type:'LIVE_UPDATE',cfg});timers.at(-1)();assert.equal(gr('GM.time'),2);timers.at(-1)();timers.at(-1)();assert.equal(gr('GM.run'),false);assert.equal(gameEls.get('mt-end').innerText,cfg.timeout);
console.log('PASS: 11 languages, RTL, all six preview scenes, persistent scene and question, live result edits, optional frame, optional timer and penalties, checkbox round trip, legacy import defaults, export isolation, message origin.');
