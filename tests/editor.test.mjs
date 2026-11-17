import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {Blob,Buffer} from 'node:buffer';
import {CompressionStream,DecompressionStream} from 'node:stream/web';
import {createEditor,Response} from './harness.mjs';
const {env,run,els,errors,element}=await createEditor();
const q=els.get('bulkQuestions');
q.value='2+2 | 4 | 5\n[ввод] Столица? | Москва~москва\n[устно] Почему? | Потому что\n[порядок] Порядок | Один | Два | Один';
assert.deepEqual(Array.from(run('parseQuestions()'),x=>x.type),['choice','input','oral','order']);
q.value='[порядок] Что? | Один';assert.throws(()=>run('parseQuestions()'),/строке 1/);
q.value='[устно] Объясните';assert.equal(run('parseQuestions()[0].c'),'');
q.value='[ввод] </script><script>alert(1)</script> | Ответ';
let game=run('getGameCode()');assert(!game.includes('</script><script>alert(1)'));for(const m of game.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
q.value='[ввод] Вопрос | Москва~московский\n[устно] Объясните | Эталон\n[порядок] Расставьте | А | Б | А';
const liveGame=run('getGameCode()');
const gameScript=[...liveGame.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
const gameEls=new Map([...liveGame.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],element('div',m[1])]));
gameEls.get('cvs').getContext=()=>({save(){},restore(){},setTransform(){},clearRect(){},fillRect(){}});
let gameEnv={document:{getElementById:id=>gameEls.get(id),querySelectorAll:()=>[],createElement:tag=>element(tag),documentElement:{style:{setProperty(){}}}},window:null,parent:{},Image:class{},setTimeout:()=>0,setInterval:()=>0,clearInterval(){},requestAnimationFrame(){},console};gameEnv.window=gameEnv;gameEnv.addEventListener=()=>{};vm.createContext(gameEnv);new vm.Script(gameScript).runInContext(gameEnv);
const gr=code=>vm.runInContext(code,gameEnv);gr("sfx=()=>{}; GM.time=60; GM.pause=true; quiz(0)");
let body=gameEls.get('q-body');body.children[0].value='  МОСКВА  ';body.children[1].onclick({stopPropagation(){}});assert.equal(gr('GM.score'),1);body.children[1].onclick({stopPropagation(){}});assert.equal(gr('GM.score'),1,'Double click does not award twice');
gr('quiz(1)');body.children[1].onclick({stopPropagation(){}});assert.equal(body.children[0].textContent,'Эталон');body.children[2].onclick({stopPropagation(){}});assert.equal(gr('GM.score'),2);
gr('quiz(2)');const list=body.children[0];assert.equal(list.children.length,3);assert.equal(list.children[0].children[1].disabled,true);assert.equal(list.children[2].children[2].disabled,true);
// Reorder using the same controls as the user; duplicate labels retain their identity.
for(let position=0;position<3;position++){
 const expected=(position+1)+'. '+['А','Б','А'][position];let found=list.children.findIndex((row,i)=>i>=position&&row.children[0].textContent.endsWith(expected.slice(3)));
 while(found>position){list.children[found].children[1].onclick({stopPropagation(){}});found--;}
}
// Check the button is wired and wrong order penalizes instead of crashing.
body.children[1].onclick({stopPropagation(){}});assert.equal(gr('GM.score'),3,'Correct order accepts identical labels');
gr('quiz(2)');body.children[0].children[1].children[1].onclick({stopPropagation(){}});
// Force a known wrong arrangement through the controls.
while(body.children[0].children[0].children[0].textContent.endsWith('А')){const bidx=body.children[0].children.findIndex(r=>r.children[0].textContent.endsWith('Б'));body.children[0].children[bidx].children[1].onclick({stopPropagation(){}});}
const timeBefore=gr('GM.time'),livesBefore=gr('GM.lives');body.children[1].onclick({stopPropagation(){}});assert.equal(gr('GM.time'),timeBefore);assert.equal(gr('GM.lives'),livesBefore-1);assert.equal(gr('GM.score'),3);
await run('generate()');const embed=els.get('finalCode').value;assert(embed.startsWith('<iframe'));assert.equal(els.get('copyBtn').disabled,false);
const loader=embed.match(/srcdoc="([\s\S]*)"><\/iframe>/)[1].replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const payload=loader.match(/atob\("([A-Za-z0-9+/=]+)"\)/)[1];
const decoded=await new Response(new Blob([Buffer.from(payload,'base64')]).stream().pipeThrough(new DecompressionStream('gzip'))).text();assert.equal(decoded,run('getGameCode()'));
run('schedulePreviewUpdate()');assert.equal(els.get('copyBtn').disabled,true);assert.equal(els.get('finalCode').value,'');
let saved;env.download=(data,name,type)=>saved={data,name,type};run('saveProject()');const project=JSON.parse(saved.data);assert.equal(project.format,'ptiza-project');const original=q.value;q.value='changed';await env.loadProject({files:[new Blob([saved.data])],value:'project'});assert.equal(q.value,original);assert.equal(errors.length,0);
run("assets.avatars=['data:image/png;base64,QQ==','data:image/png;base64,Qg=='];assets.avatarsInFlight=[null,'data:image/png;base64,Qw==']");assert.deepEqual(Array.from(run('getCFGData().img.avatarsInFlight')),[null,'data:image/png;base64,Qw==']);
const before=q.value;await env.loadProject({files:[new Blob(['{"format":"wrong"}'])],value:'bad'});assert.equal(q.value,before);assert.equal(errors.length,1);
console.log('PASS: startup, task parsing, invalid tasks, safe script serialization, generated game syntax, input alternatives, oral evaluation, ordering controls, duplicate submission, gzip round trip, stale code invalidation, project round trip, invalid project protection.');
