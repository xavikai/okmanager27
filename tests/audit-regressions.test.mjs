import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const between=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
test('invalid saved lineups repair duplicates, two keepers, wrong keeper slot and unavailable players',()=>{
 const players=Object.fromEntries(['g1','g2','f1','f2','f3','f4','f5'].map((id,i)=>[id,{id,team:'A',pos:id.startsWith('g')?'POR':'JUG',energy:100,rating:90-i}]));
 const c={S:{players,teams:{A:{lineup:[]}}},squad:id=>Object.values(players).filter(p=>p.team===id),ovr:p=>p.rating,avail:p=>!p.inj&&!p.susp};vm.createContext(c);
 vm.runInContext(between('function validLineup(', '/* ============ SIMULADOR')+between('function autoFix(','/* Cobra el viatge'),c);
 for(const lineup of [['g1','f1','f1','f2','f3'],['g1','g2','f1','f2','f3'],['f1','g1','f2','f3','f4'],[],null]){c.S.teams.A.lineup=lineup;const result=c.lineupOf('A');assert.equal(result.length,5);assert.equal(new Set(result).size,5);assert.equal(players[result[0]].pos,'POR');assert.ok(result.slice(1).every(id=>players[id].pos==='JUG'))}
 players.g1.inj=1;c.S.teams.A.lineup=['g1','f1','f2','f3','f4'];assert.equal(c.lineupOf('A')[0],'g2');
 const before=JSON.stringify(c.S.teams.A.lineup);c.autoFix('A');assert.equal(JSON.stringify(c.S.teams.A.lineup),before);
});
test('blue-card bans count threshold crossings once, even with several cards in the same match',()=>{
 for(const [before,received,bans] of [[3,2,1],[4,2,1],[8,1,0],[9,1,1],[4,6,2]]){
  const p={id:'p',team:'A',cards:before+received,susp:0},absent={id:'absent',team:'C',cards:0,susp:2};
  const news=[],c={S:{user:'A',players:{p,absent}},W:x=>x,pushNews:x=>news.push(x)};vm.createContext(c);vm.runInContext(between('function applySanctions(','/* ============ ESTADÍSTIQUES'),c);
  c.applySanctions([{h:'A',a:'B',res:{ev:Array.from({length:received},()=>({t:'blue',pid:'p'}))}}]);assert.equal(p.susp,bans);assert.equal(absent.susp,2);assert.equal(news.length,bans>0?1:0);
  c.applySanctions([{h:'A',a:'B',res:{ev:[]}}]);assert.equal(p.susp,Math.max(0,bans-1));
 }
});
test('local confirmation requires an exact persisted snapshot, with IndexedDB fallback',async()=>{
 const local=new Map(),db=new Map(),c={S:{slot:'one',round:7},slotKey:id=>id,localStorage:{getItem:k=>local.get(k)},IDB:{put:async(k,v)=>db.set(k,v),get:async k=>db.get(k)}};
 vm.createContext(c);vm.runInContext(between('async function localSaveConfirmed(','function deleteSlot('),c);
 local.set('one','{"slot":"one","round":6}');assert.equal(await c.localSaveConfirmed(),true);assert.equal(db.get('one'),JSON.stringify(c.S));
 c.IDB.put=async()=>{};c.IDB.get=async()=>null;assert.equal(await c.localSaveConfirmed(),false);
 local.set('one',JSON.stringify(c.S));assert.equal(await c.localSaveConfirmed(),true);
});
test('manual save never announces success when both local storage copies fail',async()=>{
 const messages=[],buttons=[],events={},c={S:{slot:'one'},CLOUD:{mode:null},W:x=>x,save:()=>{},localSaveConfirmed:async()=>false,toast:x=>messages.push(x),document:{addEventListener:(name,fn)=>events[name]=fn,querySelectorAll:()=>buttons}};
 const button={innerHTML:'Desar',disabled:false};buttons.push(button);vm.createContext(c);vm.runInContext(readFileSync(new URL('../manual-save.js',import.meta.url),'utf8'),c);
 await events.click({target:{closest:()=>button},preventDefault(){},stopImmediatePropagation(){}});assert.match(messages[0],/No s’ha pogut confirmar/);assert.equal(button.disabled,false);assert.equal(button.innerHTML,'Desar');
});
