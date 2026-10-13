import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const fragment=html.slice(html.indexOf('/* Press conference window */'),html.indexOf('/* ---------- Connexions amb el cicle de la partida ---------- */',html.indexOf('/* Press conference window */')));
function setup(){
  const effects=[],saved=[],timers=[];
  const c={S:{user:'a',season:1,round:2,teams:{a:{name:'Local'},b:{name:'Rival'}}},ui:{match:{round:1}},document:{addEventListener(){},getElementById(){return null},querySelector(){return null}},setTimeout(fn){timers.push(fn)},pressPanel:null,pressQs:()=>[{q:'Primera?',o:[{t:'Sí',fx:{mor:2}}]},{q:'Segona?',o:[{t:'Sí',fx:{conf:1}}]}],matchReport:()=>({head:'Crònica',P:[]}),statsBox:()=>'',esc:x=>x,W:a=>a,uiIcon:()=>'',pressAnswer:fx=>effects.push(fx),save(){saved.push(JSON.parse(JSON.stringify(c.S)))}};
  vm.createContext(c);vm.runInContext(fragment,c);c.pressPanel({h:'a',a:'b',res:{gh:2,ga:1}});return {c,effects,saved,timers};
}
test('press answers persist after advancement and survive reconstructing the panel',()=>{
  const {c,effects,saved}=setup();c.pressAct(0);assert.equal(saved.at(-1).pressSession.i,1);
  c.pressPanel({h:'a',a:'b',res:{gh:2,ga:1}});assert.equal(c.ui.press2.i,1);assert.equal(c.ui.press2.said.length,1);
  c.pressAct(0);c.pressAct(0);assert.equal(effects.length,2);assert.equal(saved.at(-1).pressSession.i,2);
});
test('invalid answers and sessions from other careers have no effects',()=>{
  const {c,effects}=setup();c.pressAct(20);c.pressAct(-2);c.pressAct(0.5);assert.equal(effects.length,0);
  c.S.user='b';c.pressAct(0);assert.equal(effects.length,0);
});
test('declining the remaining questions applies the penalty once',()=>{
  const {c,effects,saved}=setup();c.pressAct(0);c.pressAct(-1);c.pressAct(-1);
  assert.equal(effects.length,2);assert.deepEqual({...effects[1]},{afi:-2,conf:-1});assert.equal(saved.at(-1).pressSession.skip,true);
});
test('closing the conference defers it without answering or penalizing',()=>{
  const {c,effects}=setup();c.pressDialogClose();assert.equal(c.ui.pressDeferredKey,c.S.pressSession.key);assert.equal(c.S.pressSession.i,0);assert.equal(effects.length,0);
});
