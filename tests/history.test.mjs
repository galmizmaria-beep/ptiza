import assert from 'node:assert/strict';
import {Blob} from 'node:buffer';
import {createEditor} from './harness.mjs';
function memoryStorage(){const values=new Map();return {values,getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};}
const storage=memoryStorage();
const editor=await createEditor({localStorage:storage});const {els,run,env,listeners}=editor;
assert.equal(els.get('resumeOverlay').hidden,true);assert.equal(els.get('undoBtn').disabled,true);
const baseline=els.get('txtTitle').value;
function input(id,value,type='input'){const field=els.get(id);if(field.type==='checkbox')field.checked=value;else field.value=value;env.editEvent={type,target:field};run('schedulePreviewUpdate(editEvent)');}
input('txtTitle','A');input('txtTitle','AB');assert.equal(run('historyEntries.length'),2,'Typing in a field forms one action');
run('undoAction()');assert.equal(els.get('txtTitle').value,baseline);assert.equal(els.get('redoBtn').disabled,false);run('redoAction()');assert.equal(els.get('txtTitle').value,'AB');
run('undoAction()');input('txtTitle','New branch','change');assert.equal(els.get('redoBtn').disabled,true);run('redoAction()');assert.equal(els.get('txtTitle').value,'New branch');
input('useTimer',false,'change');run('undoAction()');assert.equal(els.get('useTimer').checked,true);run('redoAction()');assert.equal(els.get('useTimer').checked,false);
run("setLang('es')");assert.equal(run('currentLang'),'es');run('undoAction()');assert.equal(run('currentLang'),'ru');assert.equal(els.get('txtTitle').value,'New branch');run('redoAction()');assert.equal(run('currentLang'),'es');
run('assetWork(1)');env.testFile=new Blob(['a'],{type:'image/png'});run("assets.avatars=['data:image/png;base64,YQ=='];originalFiles.avatars=[testFile]");assert.equal(els.get('undoBtn').disabled,true);run('undoAction()');assert.equal(run('assets.avatars.length'),1);run('assetWork(-1)');run('undoAction()');assert.equal(run('assets.avatars.length'),0);run('redoAction()');assert.equal(run('assets.avatars[0]'),'data:image/png;base64,YQ==');assert.equal(run('originalFiles.avatars[0].size'),1);
run("removeAsset('avatars',0)");assert.equal(run('assets.avatars[0]'),null);run('undoAction()');assert.equal(run('assets.avatars[0]'),'data:image/png;base64,YQ==');
// Imported files form one undoable transaction.
let project=JSON.parse(run('JSON.stringify(currentProject())'));project.settings.txtTitle='Imported';await env.loadProject({files:[new Blob([JSON.stringify(project)])],value:''});assert.equal(els.get('txtTitle').value,'Imported');run('undoAction()');assert.notEqual(els.get('txtTitle').value,'Imported');run('redoAction()');assert.equal(els.get('txtTitle').value,'Imported');
let prevented=false;listeners.keydown({key:'z',ctrlKey:true,preventDefault(){prevented=true}});assert(prevented);assert.notEqual(els.get('txtTitle').value,'Imported');listeners.keydown({key:'z',metaKey:true,shiftKey:true,preventDefault(){}});assert.equal(els.get('txtTitle').value,'Imported');
// A draft also preserves an unfinished question, not only exportable projects.
input('bulkQuestions','[порядок] unfinished |','change');run("selectPreviewScene('tasks')");await run('flushDraft()');assert.equal(storage.values.size,1);
const saved=storage.getItem('ptiza-editor-draft-v1');
const reopened=await createEditor({localStorage:storage});assert.equal(reopened.els.get('resumeOverlay').hidden,false);assert.equal(reopened.els.get('settingsPanel').inert,true);assert.equal(storage.getItem('ptiza-editor-draft-v1'),saved,'Opening the page does not overwrite the saved project');
reopened.run('continueEditing()');assert.equal(reopened.els.get('resumeOverlay').hidden,true);assert.equal(reopened.els.get('settingsPanel').inert,false);assert.equal(reopened.els.get('txtTitle').value,'Imported');assert.equal(reopened.els.get('bulkQuestions').value,'[порядок] unfinished |');assert.equal(reopened.run('assets.avatars[0]'),'data:image/png;base64,YQ==');assert.equal(reopened.run('currentLang'),'es');assert.equal(reopened.els.get('useTimer').checked,false);assert.equal(reopened.els.get('undoBtn').disabled,true);assert.equal(reopened.errors.length,0);
const freshChoice=await createEditor({localStorage:storage});await freshChoice.run('startNewProject()');assert.equal(freshChoice.els.get('resumeOverlay').hidden,true);assert.equal(freshChoice.run('assets.avatars.length'),0);assert.equal(freshChoice.els.get('bulkQuestions').value,'');assert.equal(freshChoice.els.get('useTimer').checked,true);assert.equal(storage.values.size,0);const freshOpen=await createEditor({localStorage:storage});assert.equal(freshOpen.els.get('resumeOverlay').hidden,true);
// Writes and clearing are serialized: a slow prior save cannot revive the old draft.
const pendingSave=freshChoice.run('flushDraft()');const pendingClear=freshChoice.run('startNewProject()');await Promise.all([pendingSave,pendingClear]);assert.equal(storage.values.size,0);
for(let i=0;i<55;i++){freshChoice.els.get('txtTitle').value='Step '+i;freshChoice.run('captureHistory()');}assert(freshChoice.run('historyEntries.length')<=40);freshChoice.run('undoAction()');assert.equal(freshChoice.els.get('txtTitle').value,'Step 53');
const unavailable=await createEditor({localStorage:{getItem(){return null},setItem(){throw Error('QuotaExceeded')},removeItem(){}}});unavailable.els.get('txtTitle').value='Keep me';unavailable.run('captureHistory()');await unavailable.run('flushDraft()');assert.equal(unavailable.els.get('draftStatus').dataset.error,'true');assert.equal(unavailable.els.get('txtTitle').value,'Keep me');
console.log('PASS: grouped undo/redo, branch invalidation, checkbox/language/assets/import history, keyboard shortcuts, restore choice, complete draft recovery including unfinished tasks, explicit fresh start, write/delete serialization, bounded history, storage failure reporting.');

function indexedMemory(){
 const data=new Map(),stats={reads:0,writes:0,deletes:0};
 const db={objectStoreNames:{contains:()=>true},createObjectStore(){},close(){},transaction(name,mode){
  const tx={objectStore(){return {get(key){return request('get',key)},put(value,key){return request('put',key,value)},delete(key){return request('delete',key)}}}};
  function request(action,key,value){const result={};queueMicrotask(()=>{if(action==='get'){stats.reads++;result.result=data.get(key);}else if(action==='put'){stats.writes++;data.set(key,structuredClone(value));}else{stats.deletes++;data.delete(key);}tx.oncomplete?.();});return result;}
  return tx;
 }};
 return {data,stats,open(){const req={};queueMicrotask(()=>{req.result=db;req.onsuccess();});return req;}};
}
const database=indexedMemory(),backup=memoryStorage();
const dbEditor=await createEditor({indexedDB:database,localStorage:backup});dbEditor.els.get('txtTitle').value='Indexed project';dbEditor.run("assets.bg='data:image/png;base64,YQ==';originalFiles.bg=dataFile(assets.bg);captureHistory()");await dbEditor.run('flushDraft()');assert.equal(database.stats.writes,1);assert.equal(backup.values.size,0,'Images use IndexedDB rather than localStorage quota');
const dbReopened=await createEditor({indexedDB:database,localStorage:backup});assert.equal(dbReopened.els.get('resumeOverlay').hidden,false);dbReopened.run('continueEditing()');assert.equal(dbReopened.els.get('txtTitle').value,'Indexed project');assert.equal(dbReopened.run('assets.bg'),'data:image/png;base64,YQ==');await dbReopened.run('startNewProject()');assert.equal(database.data.size,0);assert.equal(database.stats.deletes,1);
const blockedDB={open(){throw Error('IndexedDB unavailable')}};const fallback=memoryStorage();const fallbackEditor=await createEditor({indexedDB:blockedDB,localStorage:fallback});fallbackEditor.els.get('txtTitle').value='Fallback project';fallbackEditor.run('captureHistory()');await fallbackEditor.run('flushDraft()');assert.equal(fallback.values.size,1);const fallbackReopen=await createEditor({indexedDB:blockedDB,localStorage:fallback});assert.equal(fallbackReopen.els.get('resumeOverlay').hidden,false);await fallbackReopen.run('startNewProject()');assert.equal(fallback.values.size,0);
console.log('PASS: IndexedDB asset persistence, IndexedDB recovery/deletion, localStorage fallback when IndexedDB is blocked.');

// An autosave delayed by image processing must retry even when the image bytes do not change.
const delayedStorage=memoryStorage(),delayed=await createEditor({localStorage:delayedStorage});let scheduled,scheduledCount=0;delayed.env.setTimeout=fn=>{scheduled=fn;scheduledCount++;return scheduledCount};delayed.els.get('txtTitle').value='Save after processing';delayed.run('captureHistory()');delayed.run('assetWork(1)');await scheduled();assert.equal(delayedStorage.values.size,0);const beforeRetry=scheduledCount;delayed.run('assetWork(-1)');assert(scheduledCount>beforeRetry);await scheduled();assert.equal(JSON.parse(delayedStorage.getItem('ptiza-editor-draft-v1')).project.settings.txtTitle,'Save after processing');
console.log('PASS: deferred autosave retries after resource processing without requiring another edit.');
