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
test('career ratings reflect documented quality, remain stable in the pool, and show clubs and honours',()=>{
 const c=setup();run(c,`newGame('MAC');ui.exTab='rep';`);
 for(const [name,rating] of [['Marc Torra',92],['Sergi Panadero',92],['Jordi Bargalló',91],['Jordi Adroher',90],['Jaume Llaverola',88],['Aleix Esteller',85]]){
  c.__name=name;assert.equal(run(c,`repPool().find(p=>p.name===__name)?.ovr`),rating,name);
 }
 assert.equal(run(c,`repPool().find(p=>p.name==='Marc Torra').age`),42);
 assert.equal(run(c,`repPool().find(p=>p.name==='Jordi Bargalló').age`),46);
 assert.match(run(c,'repView()'),/Trajectòria i palmarès/);assert.match(run(c,'repView()'),/4 Mundials/);assert.match(run(c,'repView()'),/Benfica/);
 run(c,`S.season+=3`);assert.equal(run(c,`repPool().find(p=>p.name==='Marc Torra').ovr`),92);assert.equal(run(c,`repPool().find(p=>p.name==='Marc Torra').age`),45);
 run(c,`LANG='es'`);assert.match(run(c,'repView()'),/Trayectoria y palmarés/);
});
test('both signing paths deliver the advertised rating while keeping physical stamina lower',()=>{
 for(const sign of ['repOffer','repSign']){
  const c=setup();run(c,`newGame('MAC');{const released=squad(S.user).find(p=>p.pos!=='POR');delete S.players[released.id]}autoFix(S.user);R=()=>0;`);
  run(c,sign==='repOffer'?`repOffer('Marc Torra',{sal:0,win:0,tit:false})`:`repSign('Marc Torra')`);
  assert.equal(run(c,`ovr(squad(S.user).find(p=>p.name==='Marc Torra'))`),92,sign);
  assert.equal(run(c,`squad(S.user).find(p=>p.name==='Marc Torra').repRetired`),true);
  assert.equal(run(c,`squad(S.user).find(p=>p.name==='Marc Torra').a.fis<=66`),true);
  assert.equal(run(c,`squad(S.user).find(p=>p.name==='Marc Torra').a.tec>=90`),true);
 }
});
test('retired players keep quality and consume more energy for the same minutes; bench players do not',()=>{
 const c=setup();run(c,`newGame('MAC');R=()=>0;globalThis.P=squad(S.user).find(p=>p.pos!=='POR');P.name='Marc Torra';P.comeback=S.season;applyComebackQuality(P,{name:P.name,ovr:92,now:null});P.energy=100;S.teams[S.user].lineup[1]=P.id;autoFix(S.user);globalThis.other=Object.keys(S.teams).find(id=>divOf(id)===myDiv()&&id!==S.user);globalThis.bench=squad(S.user).find(p=>p.id!==P.id&&!S.teams[S.user].lineup.includes(p.id));bench.repRetired=true;bench.energy=100;`);
 run(c,`globalThis.active=S.players[S.teams[S.user].lineup.find(id=>id!==P.id&&S.players[id].pos!=='POR')];active.energy=100;`);
 run(c,`simSeg(S.user,other,1,25,[])`);assert.equal(run(c,'P.energy'),93.5);assert.equal(run(c,'bench.energy'),100);
 run(c,`simSeg(S.user,other,26,50,[])`);assert.equal(run(c,'P.energy'),87);assert.equal(run(c,'ovr(P)'),92);assert.equal(run(c,'active.energy'),100);
 run(c,`P.repRetired=false;P.energy=100;simSeg(S.user,other,1,50,[])`);assert.equal(run(c,'P.energy'),100);
});
test('migration repairs previously signed legends once without resetting matches, stats, contracts or amateur veterans',()=>{
 const c=setup();run(c,`newGame('MAC');globalThis.P=squad(S.user).find(p=>p.pos!=='POR');P.name='Marc Torra';P.comeback=S.season;P.goals=7;P.apps=8;P.energy=64;P.inj=2;P.contract=2030;P.salary=1.23;globalThis.V=squad(S.user).find(p=>p.id!==P.id&&p.pos!=='POR');V.name='Sergi Panadero';V.vet='V';V.comeback=S.season;globalThis.vq=ovr(V);globalThis.fx=JSON.stringify(S.fx);S=migrate(JSON.parse(JSON.stringify(S)));globalThis.Q=S.players[P.id];`);
 assert.equal(run(c,'ovr(Q)'),92);assert.equal(run(c,'Q.goals'),7);assert.equal(run(c,'Q.apps'),8);assert.equal(run(c,'Q.energy'),64);assert.equal(run(c,'Q.inj'),2);assert.equal(run(c,'Q.contract'),2030);assert.equal(run(c,'Q.salary'),1.23);
 assert.equal(run(c,'ovr(S.players[V.id])'),run(c,'vq'));assert.equal(run(c,'JSON.stringify(S.fx)'),run(c,'fx'));
 const after=run(c,'JSON.stringify(S.players)');run(c,'S=migrate(JSON.parse(JSON.stringify(S)))');assert.equal(run(c,'JSON.stringify(S.players)'),after);
});
test('simulation retirees retain their last quality and active aliases cannot be duplicated',()=>{
 const c=setup();run(c,`newGame('MAC');S.retired=[{name:'Test Retirat',g:'M',pos:'JUG',nat:'ESP',ovr:87,age:39,s:2023,team:S.user}];globalThis.a=squad(S.user).find(p=>p.pos==='POR');a.name='Sergi Fernández';`);
 assert.equal(run(c,`repPool().find(p=>p.name==='Test Retirat').ovr`),87);
 assert.equal(run(c,`repPool().some(p=>p.name==='Sergio Fernandez')`),false);
});
