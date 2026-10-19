import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';
const root=new URL('../',import.meta.url).pathname.replace(/^\/(?:([A-Z]:))/,'$1');
function setup(){
const html=fs.readFileSync(root+'/index.html','utf8');
const noop=()=>{};
const el={style:{},dataset:{},classList:{add:noop,remove:noop,contains:()=>false,toggle:noop},querySelector:()=>null,querySelectorAll:()=>[],addEventListener:noop,appendChild:noop,setAttribute:noop,getAttribute:()=>''};
const storage=new Map();
const c={console,Date,TextEncoder,TextDecoder,URL,Blob,Response,fetch:async()=>{throw Error('offline audit')},navigator:{onLine:false,userAgent:'audit'},location:{hostname:'audit',href:'https://audit/'},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},document:{body:el,head:el,documentElement:el,querySelector:()=>el,querySelectorAll:()=>[],getElementById:()=>el,createElement:()=>({...el}),addEventListener:noop},window:{addEventListener:noop,claude:{hot:{snapshot:noop,ready:noop}}},setTimeout:()=>1,clearTimeout:noop,setInterval:()=>1,clearInterval:noop,confirm:()=>true};
vm.createContext(c);
vm.runInContext(fs.readFileSync(root+'/travel-costs.js','utf8'),c);
for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(m[1].trim())vm.runInContext(m[1],c);
vm.runInContext('save=()=>{};render=()=>{};toast=()=>{};',c);
return c;
}
const run=(c,js)=>vm.runInContext(js,c);
test('14 clubs, provisional disclosure, isolated female market, lineups and travel',()=>{
 const c=setup();run(c,`newGame('FPTC');ui.pickG='F';`);
 assert.equal(run(c,'TEAMS_FEM_PLATA.length'),14);
 assert.equal(run(c,'new Set(ALLTEAMS.map(t=>t.id)).size===ALLTEAMS.length'),true);
 assert.equal(run(c,'myDiv()'),'FP');assert.equal(run(c,'NROUNDS()'),26);
 assert.equal(run(c,`TEAMS_FEM_PLATA.every(t=>isFem(t.id)&&squad(t.id).length>=8&&squad(t.id).filter(p=>p.pos==='POR').length>=2&&validLineup(t.id)&&!sameG(t.id,'BAR')&&sameG(t.id,'FPAL'))`),true);
 assert.equal(run(c,`TEAMS_FEM_PLATA.every(t=>!travelEstimate(t.id,'FPAL',12,1).estimated)`),true);
 assert.equal(run(c,`TEAMS_FEM_PLATA.every(t=>squad(t.id).every(p=>p.rfepId&&!p.simulated&&!p.name.includes('simulada')))`),true);
 const picker=run(c,'pickScreen()');for(const id of ['FPTC','FPLR','FPST'])assert.ok(picker.includes(`data-pick="${id}"`));
 assert.match(picker,/jugadores reals/);assert.match(run(c,'VIEWS.mercat()'),/value="FP"/);
 run(c,`pickId='FPST'`);assert.match(run(c,'confirmScreen()'),/actes RFEP/);
 run(c,`ui.tbDiv='FP'`);assert.match(run(c,'VIEWS.classificacio()'),/dues primeres/);
 run(c,`ui.tbDiv='FEM'`);assert.match(run(c,'VIEWS.classificacio()'),/dues últimes/);
 run(c,`LANG='es'`);assert.match(run(c,'pickScreen()'),/jugadoras reales/);
});
test('calendar has 182 home/away pairings and all 14 clubs play once each round',()=>{
 const c=setup();run(c,`newGame('FPTC')`);
 assert.equal(run(c,`FX('FP').flat().length`),182);
 assert.equal(run(c,`new Set(FX('FP').flat().map(m=>m.h+'|'+m.a)).size`),182);
 assert.equal(run(c,`FX('FP').every(rd=>rd.length===7&&new Set(rd.flatMap(m=>[m.h,m.a])).size===14&&rd.every(m=>m.h!==m.a))`),true);
});
function removePlata(c,round,finished=false){c.__round=round;c.__finished=finished;run(c,`for(const t of TEAMS_FEM_PLATA){delete S.teams[t.id];delete S.div[t.id];for(const p of Object.values(S.players))if(p.team===t.id)delete S.players[p.id]}delete S.fx.FP;S.round=__round;S.finished=__finished;`)}
test('migration preserves fixtures, adds players once, defers a midseason league until rollover',()=>{
 const c=setup();run(c,`newGame('FPAL');S.fx.FEM[0][0].res={gh:3,ga:1};`);removePlata(c,5);
 const before=run(c,'JSON.stringify(S.fx.FEM)');run(c,`S=migrate(JSON.parse(JSON.stringify(S)))`);
 assert.equal(run(c,'JSON.stringify(S.fx.FEM)'),before);assert.equal(run(c,'S.fx.FP.length'),0);
 assert.match(run(c,`ui.tbDiv='FP';VIEWS.classificacio()`),/propera temporada/);
 const n=run(c,'Object.keys(S.players).length');run(c,'S=migrate(JSON.parse(JSON.stringify(S)))');assert.equal(run(c,'Object.keys(S.players).length'),n);
 assert.equal(run(c,'femaleSeasonMoves()'),null);
 run(c,`S.finished=true;newSeason()`);assert.equal(run(c,'FX("FP").length'),26);
});
test('legacy migration at kickoff activates Plata, but completed seasons wait',()=>{
 for(const finished of [false,true]){const c=setup();run(c,`newGame('BAR')`);removePlata(c,0,finished);run(c,'S=migrate(JSON.parse(JSON.stringify(S)))');assert.equal(run(c,'FX("FP").length'),finished?0:26)}
});
test('two promotions and relegations preserve female division sizes and male divisions',()=>{
 const c=setup();run(c,`newGame('FPTC');for(const d of ['FP','FEM'])for(const m of FX(d).flat())m.res={gh:1,ga:1};S.femMoves=femaleSeasonMoves();globalThis.moves=JSON.parse(JSON.stringify(S.femMoves));globalThis.men=JSON.stringify(Object.fromEntries(Object.entries(S.div).filter(([id])=>!isFem(id))));`);
 assert.equal(run(c,'moves.up.length'),2);assert.equal(run(c,'moves.down.length'),2);
 run(c,'applyFemaleMoves()');assert.equal(run(c,`moves.up.every(id=>divOf(id)==='FEM')&&moves.down.every(id=>divOf(id)==='FP')`),true);
 assert.equal(run(c,`JSON.stringify(Object.fromEntries(Object.entries(S.div).filter(([id])=>!isFem(id))))===men`),true);
 assert.equal(run(c,`['FP','FEM'].every(d=>Object.keys(S.teams).filter(id=>divOf(id)===d).length===14)`),true);
 const after=run(c,'JSON.stringify(S.div)');run(c,'applyFemaleMoves()');assert.equal(run(c,'JSON.stringify(S.div)'),after);
});
test('Plata career finishes, saves, and rolls into a second playable season',()=>{
 const c=setup();run(c,`Math.random=rng(73);newGame('FPTC');ageMigration()`);
 let steps=0;while(run(c,'!S.finished')&&steps++<45)run(c,'playRoundFast()');
 assert.ok(steps<45);assert.equal(run(c,'S.round'),26);assert.equal(run(c,`Object.values(S.teams).every(t=>Number.isFinite(t.budget))`),true);
 assert.equal(run(c,`S.femMoves.up.length===2&&S.femMoves.down.length===2`),true);
 const up=run(c,'JSON.stringify(S.femMoves.up)');run(c,'S=migrate(JSON.parse(JSON.stringify(S)))');assert.equal(run(c,'JSON.stringify(S.femMoves.up)'),up);
 run(c,'newSeason()');assert.equal(run(c,'S.season'),2027);assert.equal(run(c,'NROUNDS()'),26);
 assert.equal(run(c,`['FP','FEM'].every(d=>FX(d).flat().length===182)`),true);
 run(c,'autoFix(S.user);playRoundFast()');assert.equal(run(c,'S.round'),1);
});
test('simulated saves gain real identities once, preserve statistics and fixtures, and retain transfers',()=>{
 const c=setup();run(c,`newGame('FPTC');S.round=4;globalThis.old=TEAMS_FEM_PLATA.find(t=>t.id==='FPLR');globalThis.P=squad('FPLR').find(p=>p.pos==='JUG');P.name='Jugadora 1 · simulada';P.simulated=true;delete P.rfepId;P.goals=6;P.apps=4;P.energy=63;P.inj=2;globalThis.pid=P.id;globalThis.transfer=squad('FPTC').find(p=>p.pos==='JUG');transfer.team='FPAL';globalThis.transid=transfer.id;delete S.femalePlataRosterV;globalThis.fx=JSON.stringify(S.fx);globalThis.bud=JSON.stringify(Object.fromEntries(Object.entries(S.teams).map(([id,t])=>[id,t.budget])));S=migrate(JSON.parse(JSON.stringify(S)));`);
 assert.equal(run(c,'S.players[pid].simulated'),undefined);assert.ok(run(c,'S.players[pid].rfepId'));
 assert.equal(run(c,'S.players[pid].goals'),6);assert.equal(run(c,'S.players[pid].apps'),4);assert.equal(run(c,'S.players[pid].energy'),63);assert.equal(run(c,'S.players[pid].inj'),2);
 assert.equal(run(c,'S.players[transid].team'),'FPAL');assert.equal(run(c,'JSON.stringify(S.fx)'),run(c,'fx'));assert.equal(run(c,'JSON.stringify(Object.fromEntries(Object.entries(S.teams).map(([id,t])=>[id,t.budget])))'),run(c,'bud'));
 const after=run(c,'JSON.stringify(S.players)');run(c,'S=migrate(JSON.parse(JSON.stringify(S)))');assert.equal(run(c,'JSON.stringify(S.players)'),after);
});
test('a full v47 save replaces all fictional squads without losing results or breaking lineups',()=>{
 const c=setup();c.__legacy=JSON.parse(fs.readFileSync(new URL('./fixtures/female-plata-v47.json',import.meta.url),'utf8'));
 run(c,`newGame('FPST');for(const t of TEAMS_FEM_PLATA)for(const p of squad(t.id))delete S.players[p.id];for(const t of __legacy)for(const a of t.p){const id='p'+S.nextId++;S.players[id]=makePlayer(a,t.id,id)}for(const t of TEAMS_FEM_PLATA)autoLineup(t.id);S.round=3;delete S.femalePlataRosterV;S.fx.FP[0][0].res={gh:2,ga:1};globalThis.fx=JSON.stringify(S.fx);S=migrate(JSON.parse(JSON.stringify(S)));`);
 assert.equal(run(c,`Object.values(S.players).some(p=>p.simulated&&/simulada/.test(p.name))`),false);
 assert.equal(run(c,`TEAMS_FEM_PLATA.every(t=>validLineup(t.id)&&squad(t.id).filter(p=>p.pos==='POR').length>=2)`),true);
 assert.equal(run(c,'JSON.stringify(S.fx)'),run(c,'fx'));
});
