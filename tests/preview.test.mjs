import assert from 'node:assert/strict';
import vm from 'node:vm';
import {Blob} from 'node:buffer';
import {createEditor} from './harness.mjs';
const {env,els,run,element,errors}=await createEditor();
run("selectPreviewScene('win');selectPreviewScene('play')");assert.equal(run('lastEditScene'),'win');assert.equal(els.get('testGameBtn')['aria-pressed'],'true');run('selectPreviewScene(lastEditScene)');assert.equal(run('previewScene'),'win');assert.equal(els.get('editGameBtn')['aria-pressed'],'true');
els.get('bgOverlayColor').value='#123456';els.get('bgOverlayOpacity').value='45';els.get('bgImageOpacity').value='60';assert.equal(run('getCFGData().bgOverlayOpacity'),.45);assert.equal(run('getCFGData().bgImageOpacity'),.6);
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
assert.equal(els.get('bgOverlayColor').value,'#123456');assert.equal(els.get('bgOverlayOpacity').value,'45');assert.equal(els.get('bgImageOpacity').value,'60');
const legacy=JSON.parse(saved);delete legacy.settings.bgOverlayColor;delete legacy.settings.bgOverlayOpacity;delete legacy.settings.bgImageOpacity;delete legacy.settings.useFrame;delete legacy.settings.useTimer;await env.loadProject({files:[new Blob([JSON.stringify(legacy)])],value:''});assert.equal(els.get('useFrame').checked,true);assert.equal(els.get('useTimer').checked,true);assert.equal(errors.length,0);
assert.equal(run('getCFGData().bgOverlayOpacity'),0);assert.equal(run('getCFGData().bgImageOpacity'),1);
const game=run('getGameCode(true)'),script=[...game.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
const gameEls=new Map([...game.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],element('div',m[1])]));
const noop=()=>{};const transforms=[],draws=[],fills=[],stack=[];const ctx={setTransform:(...args)=>transforms.push(args),clearRect:noop,globalAlpha:1,fillRect:(...args)=>fills.push({alpha:ctx.globalAlpha,color:ctx.fillStyle,args}),drawImage:(...args)=>draws.push(args),save:()=>stack.push({globalAlpha:ctx.globalAlpha,fillStyle:ctx.fillStyle}),restore:()=>Object.assign(ctx,stack.pop()),beginPath:noop,moveTo:noop,lineTo:noop,closePath:noop,fill:noop,arc:noop,translate:noop,rotate:noop};gameEls.get('cvs').getContext=()=>ctx;
const handlers={},timers=[],frameCallbacks=[];const styleVars={};const gameEnv={document:{getElementById:id=>{assert(gameEls.has(id),'Missing game element '+id);return gameEls.get(id)},querySelectorAll:()=>[],createElement:tag=>element(tag),documentElement:{style:{setProperty:(k,v)=>styleVars[k]=v}}},parent:{},window:null,Image:class{},setTimeout:noop,setInterval:fn=>{timers.push(fn);return timers.length},clearInterval:noop,requestAnimationFrame:fn=>frameCallbacks.push(fn),console,devicePixelRatio:2,innerWidth:1000,innerHeight:700};gameEnv.window=gameEnv;gameEnv.addEventListener=(type,fn)=>handlers[type]=fn;vm.createContext(gameEnv);new vm.Script(script).runInContext(gameEnv);const gr=code=>vm.runInContext(code,gameEnv);gr('sfx=()=>{};resize()');
assert.equal(gameEls.get('cvs').width,2000);assert.equal(gameEls.get('cvs').height,1400);assert.equal(gr('W'),1000);assert.deepEqual(transforms.at(-1),[2,0,0,2,0,0]);assert.equal(ctx.imageSmoothingQuality,'high');
gr('drawContained({naturalWidth:100,naturalHeight:200},0,0,100,100)');assert.deepEqual(draws.at(-1).slice(1),[25,0,50,100]);
gameEnv.devicePixelRatio=1;gr('resize()');assert.equal(gameEls.get('cvs').width,1000);assert.deepEqual(transforms.at(-1),[1,0,0,1,0,0]);
const message=data=>handlers.message({source:gameEnv.parent,data});
for(const scene of ['title','game','tasks','win','lose','timeout']){message({type:'PREVIEW_SCENE',scene,question:0});assert.equal(gr('editorScene'),scene);assert.equal(gr('GM.run'),false);if(scene==='tasks')assert.equal(gameEls.get('quiz-box').style.display,'block');}
assert.equal(gameEls.get('mt-end').innerText,els.get('txtTimeout').value);
let cfg=run('getCFGData()');cfg.bgOverlayColor='#123456';cfg.bgOverlayOpacity=.45;cfg.bgImageOpacity=0;message({type:'LIVE_UPDATE',cfg});gr('drawBg()');assert.equal(fills.at(-1).alpha,.45);assert.equal(fills.at(-1).color,'#123456');assert.equal(ctx.globalAlpha,1,'Overlay alpha must not leak into character drawing');cfg.win='Новая победа';message({type:'PREVIEW_SCENE',scene:'win'});message({type:'LIVE_UPDATE',cfg});assert.equal(gameEls.get('mt-end').innerText,'Новая победа');assert.equal(gr('editorScene'),'win');
cfg.lose='Новое поражение';message({type:'PREVIEW_SCENE',scene:'lose'});message({type:'LIVE_UPDATE',cfg});assert.equal(gameEls.get('mt-end').innerText,'Новое поражение');
run("setLang('ar')");cfg=run('getCFGData()');message({type:'PREVIEW_SCENE',scene:'tasks',question:1});message({type:'LIVE_UPDATE',cfg});assert.equal(gameEnv.document.documentElement.dir,'rtl');assert.equal(gameEls.get('q-body').children[1].textContent,cfg.lang.dict.sample);assert.equal(gameEls.get('q-txt').textContent,'Два','User questions are preserved');
// Untimed mode hides the HUD and has no second penalties, including wrong answers.
cfg.timerEnabled=false;cfg.useFrame=false;cfg.frame_img='';message({type:'LIVE_UPDATE',cfg});assert.equal(gameEls.get('hud-time').style.display,'none');assert.equal(styleVars['--selection-frame'],'none');gr('GM.time=5;quiz(0)');gameEls.get('q-body').children[0].value='wrong';gameEls.get('q-body').children[1].onclick({stopPropagation(){}});assert.equal(gr('GM.time'),5);
// Wrong answers cost a life; running out of lives loses even with time remaining.
cfg.timerEnabled=true;message({type:'LIVE_UPDATE',cfg});gr('GM.run=true;GM.lives=1;GM.time=5;quiz(0)');gameEls.get('q-body').children[0].value='wrong';gameEls.get('q-body').children[1].onclick({stopPropagation(){}});assert.equal(gameEls.get('mt-end').innerText,cfg.lose);assert.equal(gr('GM.lives'),0);assert.equal(gr('GM.time'),5);
// Other windows cannot control preview scene or settings.
handlers.message({source:{},data:{type:'PREVIEW_SCENE',scene:'title'}});assert.equal(gr('editorScene'),'tasks');
// Timer ticks obey the checkbox during an actual test run.
message({type:'PREVIEW_SCENE',scene:'play'});cfg.timerEnabled=false;message({type:'LIVE_UPDATE',cfg});gr('selectedAvatar="avatar";selectedCreature="creature";GM.start();GM.time=3');timers.at(-1)();assert.equal(gr('GM.time'),3);cfg.timerEnabled=true;message({type:'LIVE_UPDATE',cfg});timers.at(-1)();assert.equal(gr('GM.time'),2);timers.at(-1)();timers.at(-1)();assert.equal(gr('GM.run'),false);assert.equal(gameEls.get('mt-end').innerText,cfg.timeout);
// Authoring preview uses gameplay scales and speed, while remaining non-interactive.
message({type:'PREVIEW_SCENE',scene:'game'});
gr('Object.assign(iCreature,{complete:true,naturalWidth:100,naturalHeight:100});Object.assign(iAvatar,{complete:true,naturalWidth:100,naturalHeight:200});Object.assign(iCoin,{src:"coin",complete:true,naturalWidth:100,naturalHeight:100});CFG.scale=1;CFG.objScale=1;previewTravel=0');
draws.length=0;gr('drawEditorFlight()');const creatureWidth=draws[0][3],coinWidth=draws[2][3];
gr('CFG.scale=2;CFG.objScale=2');draws.length=0;gr('drawEditorFlight()');assert.equal(draws[0][3],creatureWidth*2);assert.equal(draws[2][3],coinWidth*2);
gr('CFG.speed=2;previewTravel=0;preGameLoop()');assert.equal(gr('previewTravel'),8);gr('CFG.speed=8;preGameLoop()');assert.equal(gr('previewTravel'),40);assert.equal(gr('GM.run'),false);
els.get('frameFill').value='#123456';els.get('frameFillOpacity').value='40';els.get('frameLineColor').value='#abcdef';els.get('frameLineWidth').value='7';els.get('frameLineStyle').value='solid';els.get('choiceActiveFill').value='#654321';els.get('useFrame').checked=true;
cfg=run('getCFGData()');message({type:'LIVE_UPDATE',cfg});assert.equal(styleVars['--frame-fill'],cfg.frameFill);assert.equal(styleVars['--frame-outline'],'7px solid #abcdef');assert.equal(styleVars['--choice-active-fill'],'#654321');
cfg.frame_img='custom-frame';message({type:'LIVE_UPDATE',cfg});assert.equal(styleVars['--frame-fill'],'transparent');assert.equal(styleVars['--frame-outline'],'0px solid transparent');
assert(!/#end-card[^{}]*:before/.test(game),'No built-in result icons');
gr("CFG.winImg='win-art';CFG.loseImg='lose-art';CFG.timeoutImg=null;renderEnd('timeout')");assert.equal(gameEls.get('end-img').style.display,'none');gr("CFG.timeoutImg='timeout-art';renderEnd('timeout')");assert.equal(gameEls.get('end-img').src,'timeout-art');assert.equal(gameEls.get('end-img').style.display,'block');gr('renderEnd(true)');assert.equal(gameEls.get('end-img').src,'win-art');gr('renderEnd(false)');assert.equal(gameEls.get('end-img').src,'lose-art');
run("selectPreviewScene('win')");env.schedulePreviewUpdate({target:{id:'sizeRange'},type:'input'});assert.equal(run('previewScene'),'game');env.schedulePreviewUpdate({target:{id:'frameLineStyle'},type:'input'});assert.equal(run('previewScene'),'title');
// Test mode uses the actual game loop, spawning and drawing both object types.
message({type:'PREVIEW_SCENE',scene:'play'});
gr("selectedAvatar='avatar';selectedCreature='creature';CFG.qs=[{t:'2+2',type:'choice',c:'4',w:['5']}];CFG.timerEnabled=false;GM.score=7;GM.objs=[{t:'o',z:99999}];Object.assign(iObs,{src:'obstacle',complete:true,naturalWidth:100,naturalHeight:100});GM.start()");
assert.equal(gr('GM.score'),0);assert(gr("GM.objs.some(o=>o.t==='c')"));assert(gr("GM.objs.some(o=>o.t==='o')"));assert(!gr('GM.objs.some(o=>o.z===99999)'));
draws.length=0;gr('mainLoop()');assert(draws.some(d=>d[0]===gr('iCoin')));assert(draws.some(d=>d[0]===gr('iObs')));
gr("iCoin.src='';iObs.src='';GM.pause=true");const fillCount=fills.length;gr('mainLoop()');assert(fills.length>fillCount+1,'Missing object uploads have visible fallback sprites');
gr('hit({t:"c",qid:0})');assert.equal(gameEls.get('quiz-box').style.display,'block');assert.equal(gr('GM.pause'),true);
run("selectPreviewScene('play')");assert(els.get('gamePreview').srcdoc.includes('"previewScene":"play"'),'Test starts a fresh real-game session');
// Cards change surface alpha only; uploaded background keeps moving behind pauses/results.
for(const [kind,value] of [['quiz',0],['win',30],['lose',60],['timeout',100]])els.get(kind+'Opacity').value=String(value);
const surfaceCFG=run('getCFGData()');message({type:'LIVE_UPDATE',cfg:surfaceCFG});
for(const kind of ['quiz','win','lose','timeout'])assert.equal(styleVars['--'+kind+'-surface'],surfaceCFG[kind+'Surface']);
assert(surfaceCFG.quizSurface.endsWith(', 0)'));assert(surfaceCFG.winSurface.endsWith(', 0.3)'));assert(surfaceCFG.timeoutSurface.endsWith(', 1)'));
assert(game.includes('#scr-end{background:transparent}'));
gr("Object.assign(iBg,{src:'uploaded-bg',complete:true,naturalWidth:100,width:100,height:100});GM.run=true;GM.pause=true;GM.bgY=0");draws.length=0;gr('mainLoop()');assert.equal(gr('GM.bgY'),.5);assert(draws.some(d=>d[0]===gr('iBg')));
for(const reason of [true,false,'timeout']){gameEnv.endReason=reason;gr('GM.run=true;GM.end(endReason)');const before=gr('GM.bgY');assert.equal(frameCallbacks.length,1,'Only one animation callback remains pending');draws.length=0;frameCallbacks.shift()();assert(gr('GM.bgY')>before);assert(draws.some(d=>d[0]===gr('iBg')));}
let surfaceProject;env.download=data=>surfaceProject=data;run('saveProject()');await env.loadProject({files:[new Blob([surfaceProject])],value:''});assert.equal(els.get('winOpacity').value,'30');assert.equal(els.get('quizOpacity').value,'0');
// Life rules: collision checkbox, incorrect answers, remaining-life victory and timeout priority.
gameEnv.document.body={appendChild:noop};
gr("CFG.initialLives=3;CFG.lifeEmoji='💎';CFG.timerEnabled=false;GM.run=true;GM.lives=3;CFG.collisionLifeLoss=false;hit({t:'o'})");assert.equal(gr('GM.lives'),3);
gr("CFG.collisionLifeLoss=true;hit({t:'o'})");assert.equal(gr('GM.lives'),2);assert.equal(gameEls.get('life-icon').textContent,'💎');assert.equal(gameEls.get('ui-lives').textContent,2);
gr("CFG.collisionLifeLoss=false;CFG.qs=[{t:'Question',type:'choice',c:'yes',w:['no']}];GM.lives=2;quiz(0)");const wrongAnswer=gameEls.get('q-body').children.find(b=>b.textContent==='no');wrongAnswer.onclick({stopPropagation(){}});assert.equal(gr('GM.lives'),1);wrongAnswer.onclick({stopPropagation(){}});assert.equal(gr('GM.lives'),1,'Double submission costs only one life');
gr('GM.run=true;GM.pause=false;GM.score=0;GM.objs=[];waveManager.qIndex=1;waveManager.timer=100;mainLoop()');assert.equal(gameEls.get('end-card').dataset.result,'win','Surviving with a non-perfect score wins');
gr("GM.run=true;GM.lives=1;quiz(0)");gameEls.get('q-body').children.find(b=>b.textContent==='no').onclick({stopPropagation(){}});assert.equal(gr('GM.lives'),0);assert.equal(gr('GM.run'),false);assert.equal(gameEls.get('end-card').dataset.result,'lose');
gr('GM.reset()');assert.equal(gr('GM.lives'),3);
gr("selectedAvatar='avatar';selectedCreature='creature';CFG.timerEnabled=true;GM.start();GM.time=1;GM.pause=true");timers.at(-1)();assert.equal(gr('GM.run'),false);assert.equal(gameEls.get('end-card').dataset.result,'timeout','Timer expires during question even with lives remaining');
gr('GM.run=true;GM.time=0;GM.lives=3;GM.end(true)');assert.equal(gameEls.get('end-card').dataset.result,'timeout','Timeout overrides victory');
// Title frame roundtrip and backward-compatible defaults.
els.get('lifeCount').value='5';els.get('lifeEmoji').value='🍀';els.get('collisionLifeLoss').checked=false;els.get('useTitleFrame').checked=true;els.get('titleFrameWidth').value='6';els.get('titleFrameStyle').value='dashed';els.get('titleFrameColor').value='#123456';els.get('titleFrameOpacity').value='40';els.get('titleFrameRadius').value='30';els.get('titleFramePadding').value='24';
const lifeCfg=run('getCFGData()');message({type:'LIVE_UPDATE',cfg:lifeCfg});assert.equal(styleVars['--title-frame-line'],'6px dashed #123456');assert.equal(styleVars['--title-frame-radius'],'30px');assert.equal(styleVars['--title-frame-padding'],'24px');assert.equal(styleVars['--title-frame-fill'],lifeCfg.titleFrameFill);
let lifeProject;env.download=data=>lifeProject=data;run('saveProject()');await env.loadProject({files:[new Blob([lifeProject])],value:''});assert.equal(run('getCFGData().initialLives'),5);assert.equal(run('getCFGData().lifeEmoji'),'🍀');assert.equal(run('getCFGData().collisionLifeLoss'),false);assert.equal(run('getCFGData().useTitleFrame'),true);
const preLives=JSON.parse(lifeProject);for(const key of ['lifeCount','lifeEmoji','collisionLifeLoss','useTitleFrame','titleFrameColor','titleFrameWidth'])delete preLives.settings[key];await env.loadProject({files:[new Blob([JSON.stringify(preLives)])],value:''});assert.equal(run('getCFGData().initialLives'),3);assert.equal(run('getCFGData().useTitleFrame'),false);message({type:'LIVE_UPDATE',cfg:run('getCFGData()')});assert.equal(styleVars['--title-frame-fill'],'transparent');assert.equal(styleVars['--title-frame-padding'],'0px');
console.log('PASS: lives, selectable emoji, optional collision penalty, mandatory wrong-answer penalty, surviving-life victory, timeout during questions, title frame controls, project migration.');
console.log('PASS: independent card transparency persists, uploaded background animates during questions and every result, single animation scheduler.');
console.log('PASS: real test loop draws obstacles and coins, visible missing-asset fallbacks, fresh score/waves, coin opens question.');
console.log('PASS: live flight speed and scales, frame fill/line, choice colors, uploaded-only result artwork, automatic preview scene.');
console.log('PASS: 11 languages, RTL, all six preview scenes, persistent scene and question, live result edits, optional frame, optional timer and penalties, checkbox round trip, legacy import defaults, export isolation, message origin.');
