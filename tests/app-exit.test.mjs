import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../app-exit.js',import.meta.url),'utf8');
function setup(){
 const calls=[],elements={app:{},sndBtn:{},musBtn:{}},events={};
 const c={S:null,MODE:null,APP_EXITED:false,MZ:{audio:{pause:()=>calls.push('pause'),currentTime:42}},SND:{on:true,ctx:{suspend:()=>{calls.push('suspend');return Promise.resolve()},resume:()=>{calls.push('resume');return Promise.resolve()}}},document:{getElementById:id=>elements[id],addEventListener:(k,f)=>events[k]=f},window:{scrollTo(){},close:()=>calls.push('close')},W:s=>s,render:()=>calls.push('render')};
 vm.createContext(c);vm.runInContext(source,c);
 const click=selector=>events.click({preventDefault(){},target:{closest:s=>s===selector?{}:null}});
 return {c,calls,elements,click};
}
test('exit silences audio and offers a truthful fallback when window remains open; return restores menu',()=>{
 const t=setup();t.click('[data-app-exit]');assert.equal(t.c.APP_EXITED,true);assert.equal(t.c.MZ.audio.currentTime,0);assert.deepEqual(t.calls,['pause','suspend','close']);assert.equal(t.elements.sndBtn.hidden,true);assert.match(t.elements.app.innerHTML,/Ja pots tancar/);
 t.click('[data-app-return]');assert.equal(t.c.APP_EXITED,false);assert.equal(t.elements.sndBtn.hidden,false);assert.deepEqual(t.calls.slice(-2),['resume','render']);
});
test('exit cannot abandon an active manager or fantasy game',()=>{
 const t=setup();t.c.S={slot:'saved'};t.click('[data-app-exit]');assert.deepEqual(t.calls,[]);assert.equal(t.c.APP_EXITED,false);
 t.c.S=null;t.c.MODE='fantasy';t.click('[data-app-exit]');assert.deepEqual(t.calls,[]);
});
