import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('/* ============ MÚSICA DEL MENÚ'),html.indexOf('/* El primer toc desbloqueja'));
function setup(){
 const events={},buttons=new Map(),audio={paused:true,currentTime:0,plays:0,pauses:0,play(){this.paused=false;this.plays++;return Promise.resolve()},pause(){this.paused=true;this.pauses++}};
 const c={LANG:'ca',S:null,MODE:null,startStep:'menu',SND:{on:true,unlocked:false},W:s=>s,localStorage:{getItem:()=>null,setItem(){}},sndSet(on){c.SND.on=on},document:{visibilityState:'visible',getElementById:id=>buttons.get(id),createElement:tag=>tag==='audio'?audio:{style:{},setAttribute(){},getAttribute(){return ""},addEventListener(){}},body:{appendChild:b=>buttons.set(b.id,b)},addEventListener:(k,f)=>events[k]=f},window:{addEventListener:(k,f)=>events[k]=f}};
 vm.createContext(c);vm.runInContext(source,c);return {c,audio,events,buttons,run:s=>vm.runInContext(s,c)};
}
test('music starts only after interaction on the main menu and stops immediately in a saved game',()=>{
 const t=setup();t.run('sndScene()');assert.equal(t.audio.plays,0);
 t.c.SND.unlocked=true;t.run('sndScene()');assert.equal(t.audio.src,'audio/ice-management.mp3');assert.equal(t.audio.loop,true);assert.equal(t.audio.plays,1);
 t.c.S={slot:'old-save'};t.run('sndScene()');assert.equal(t.audio.paused,true);assert.equal(t.audio.currentTime,0);assert.equal(t.buttons.get('musBtn').hidden,true);
 t.c.S=null;t.run('sndScene()');assert.equal(t.audio.plays,2);
 for(const step of ['pick','confirm','help']){t.c.startStep=step;t.run('sndScene()');assert.equal(t.audio.paused,true)}
 t.c.startStep='menu';t.c.MODE='fantasy';t.run('sndScene()');assert.equal(t.audio.paused,true);
});
test('music and effects mute independently; hidden pages and rejected autoplay are handled',async()=>{
 const t=setup();t.c.SND.unlocked=true;t.run('sndScene();musSet(false)');assert.equal(t.audio.paused,true);assert.equal(t.c.SND.on,true);
 t.c.SND.on=false;t.run('musSet(true)');assert.equal(t.c.SND.on,false);assert.equal(t.audio.paused,false);t.run('sndScene()');assert.equal(t.audio.paused,false);t.audio.currentTime=42;t.run('musSet(false)');assert.equal(t.audio.currentTime,42);t.run('musSet(true)');assert.equal(t.audio.currentTime,42);
 t.c.SND.on=true;t.c.document.visibilityState='hidden';t.events.visibilitychange();assert.equal(t.audio.paused,true);
 t.c.document.visibilityState='visible';t.events.pageshow();assert.equal(t.audio.paused,false);t.events.pagehide();assert.equal(t.audio.paused,true);
 t.audio.play=()=>Promise.reject(Error('autoplay'));t.run('sndScene()');await Promise.resolve();
});
test('old music is removed, sound effects remain and MP3 is shipped offline',()=>{
 assert.ok(!html.includes('const TRACKS='));assert.ok(!html.includes('data-mtrack'));assert.ok(!html.includes('function musicLevel('));
 for(const effect of ['click','nav','ok','no','goal','whistle'])assert.ok(html.includes('k==="'+effect+'"'));
 assert.ok(readFileSync(new URL('../sw.js',import.meta.url),'utf8').includes('"audio/ice-management.mp3"'));
 assert.ok(readFileSync(new URL('../scripts/build-site.cjs',import.meta.url),'utf8').includes("'audio'"));
 assert.ok(readFileSync(new URL('../audio/ice-management.mp3',import.meta.url)).length>1000000);
});

test('redrawing music status keeps the icon node intact and controls do not trigger the pointer sound handler',()=>{
 const t=setup();t.run('sndScene()');const button=t.buttons.get('musBtn');let writes=0,value=button.innerHTML;
 Object.defineProperty(button,'innerHTML',{get:()=>value,set:v=>{value=v;writes++}});
 t.run('sndScene();sndScene()');assert.equal(writes,0,'unchanged icon is never replaced during a gesture');
 t.run('musSet(false)');assert.equal(writes,1);t.run('sndScene()');assert.equal(writes,1);
 const start=html.indexOf('/* El primer toc desbloqueja');const end=html.indexOf('sndBtn();musBtn();',start);
 const pointer=html.slice(start,end);assert.ok(!pointer.includes('setTimeout(sndScene'));
 const events={},calls=[];
 const c={document:{addEventListener:(k,f)=>events[k]=f},SND:{on:true,unlocked:false},actx:()=>calls.push('context'),sndScene:()=>calls.push('music'),sfx:k=>calls.push(k)};
 vm.createContext(c);vm.runInContext(pointer,c);
 for(const id of ['sndBtn','musBtn'])events.pointerdown({target:{closest:s=>s.includes('#'+id)?{}:null}});
 assert.deepEqual(calls,[],'toggling audio controls never starts music or a sound before click');
 events.pointerdown({target:{closest:()=>null}});assert.deepEqual(calls,['context','music'],'first interaction starts playback synchronously');
});
