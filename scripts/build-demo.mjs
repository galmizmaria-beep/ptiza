import fs from 'node:fs/promises';
import {Buffer} from 'node:buffer';
import {createEditor} from '../tests/harness.mjs';
const {run,els,env}=await createEditor();
const image=(body)=>'data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">'+body+'</svg>').toString('base64');
env.demoAssets={
 avatars:[image('<circle cx="80" cy="80" r="54" fill="#faac49"/><circle cx="62" cy="70" r="7"/><circle cx="98" cy="70" r="7"/><path d="M55 95 Q80 120 105 95" fill="none" stroke="#321b0c" stroke-width="7"/>')],
 creatures:[image('<path d="M80 55 Q15 10 4 100 L62 125 L80 100 L98 125 L156 100 Q145 10 80 55" fill="#00bedc" stroke="#90f0ff" stroke-width="5"/>')],
 coin:image('<circle cx="80" cy="80" r="64" fill="#ffd755" stroke="#ffae1c" stroke-width="10"/><text x="80" y="106" font-size="80" font-family="sans-serif" text-anchor="middle" fill="#7a4800">?</text>'),
 obs:image('<path d="M30 25 L95 10 L145 60 L135 120 L70 150 L15 100Z" fill="#756a94" stroke="#b3a4ce" stroke-width="6"/><circle cx="60" cy="60" r="18" fill="#55476f"/><circle cx="100" cy="106" r="24" fill="#55476f"/>')
};
run('Object.assign(assets,demoAssets)');
els.get('bulkQuestions').value='Сколько будет 2 + 2? | 4 | 5 | 6\n[ввод] Столица России? | Москва\n[устно] Назови три времени года | Например: весна, лето, осень\n[порядок] Расставь числа от меньшего к большему | 1 | 2 | 3';
let saved;env.download=(data,name)=>saved=data;run('saveProject()');
await fs.writeFile(new URL('../ptiza-demo-project.json',import.meta.url),saved);
await fs.writeFile(new URL('../ptiza-game.html',import.meta.url),run('getGameCode()'));
await fs.copyFile(new URL('../index.html',import.meta.url),new URL('../ptiza-editor.html',import.meta.url));
console.log('Built ptiza-editor.html, ptiza-game.html, ptiza-demo-project.json');
