import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../app-updates.js',import.meta.url),'utf8');
function setup({saved=true,online=true}={}){
 const events={},nodes=[],messages=[],local=new Map();let reloads=0;
 const doc={visibilityState:'visible',querySelector:()=>({content:'old'}),createElement:()=>({style:{},setAttribute(){},append(...n){this.children=n}}),body:{appendChild:n=>nodes.push(n)},addEventListener:(e,f)=>events[e]=f};
 const c={document:doc,navigator:{onLine:online},window:{addEventListener:(e,f)=>events[e]=f},location:{reload:()=>reloads++},S:{slot:'1',round:8},ui:{},view:'inici',W:s=>s,toast:s=>messages.push(s),setInterval:()=>{},slotKey:id=>'slot-'+id,localStorage:{getItem:k=>local.get(k)},IDB:{put:async()=>{},get:async()=>null},save(){if(saved)local.set('slot-1',JSON.stringify(c.S))},fetch:async u=>({ok:true,json:async()=>({version:'new'}),text:async()=>'<meta name="hm27-version" content="new">'})};
 vm.createContext(c);vm.runInContext(source.replace('setInterval(check,300000);check();','setInterval(check,300000);window.testUpdates={check,apply};'),c);return {c,nodes,messages,events,reloads:()=>reloads};
}
test('resuming an old installed app shows the update action and preserves its save before reload',async()=>{
 const t=setup();await t.c.window.testUpdates.check();assert.equal(t.nodes.length,1);await t.nodes[0].children[1].onclick();assert.equal(t.reloads(),1);assert.equal(t.c.localStorage.getItem('slot-1'),JSON.stringify(t.c.S));
});
test('failed storage or failed download keeps the game open',async()=>{
 const t=setup({saved:false});await t.c.window.testUpdates.check();await t.c.window.testUpdates.apply();assert.equal(t.reloads(),0);assert.equal(t.messages.length,1);
 const r=setup();await r.c.window.testUpdates.check();r.c.fetch=async()=>{throw Error('offline')};await r.c.window.testUpdates.apply();assert.equal(r.reloads(),0);
});
test('offline checks and live matches do not trigger a reload',async()=>{
 const t=setup({online:false});await t.c.window.testUpdates.check();assert.equal(t.nodes.length,0);
 t.c.navigator.onLine=true;await t.c.window.testUpdates.check();t.c.ui.match={m:{live:true}};t.c.view='partit';await t.c.window.testUpdates.apply();assert.equal(t.reloads(),0);assert.match(t.messages[0],/partit/);
});
test('release metadata, service worker and shipped page agree',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 const version=JSON.parse(readFileSync(new URL('../data/app-version.json',import.meta.url),'utf8')).version;
 assert.ok(html.includes('content="'+version+'"'));assert.ok(sw.includes('const CACHE="'+version+'"'));assert.ok(html.includes('src="app-updates.js"'));
});
