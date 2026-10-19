import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
function setup(options={}){
 const storage=new Map(),idb=new Map(),writes=[],events=new Map(),list=[{id:'1',name:'Local',upd:200}];
 const old={slot:'1',user:'BAR',season:2026,round:9,teams:{BAR:{name:'Local'}},players:{local:{goals:4}},upd:200};storage.set('save',JSON.stringify(old));storage.set('slots',JSON.stringify(list));
 const remote={slot:'1',user:'BAR',season:2026,round:3,teams:{BAR:{name:'Cloud'}},players:{remote:{goals:2}},upd:100};
 const c={crypto:{randomUUID:()=> 'test-copy'},CLOUD:{uid:'alice',mode:'cf',idx:{slots:{1:{version:'v1'}}}},S:null,Map,JSON,Number,Error,Promise,encodeURIComponent,W:a=>a,esc:x=>x,toast(){},render(){},migrate:s=>s,gunz:async x=>x,
   localStorage:{getItem:k=>storage.get(k)||null,setItem(k,v){if(options.fail)throw Error('quota');storage.set(k,v)}},IDB:{async put(k,v){if(!options.fail)idb.set(k,v)},async get(k){return idb.get(k)}},
   SLOTS_KEY:'slots',slotKey:id=>id==='1'?'save':'save:'+id,slotsList:()=>JSON.parse(storage.get('slots')||'[]'),loadSlotAsync:async id=>JSON.parse(storage.get(id==='1'?'save':'save:'+id)||'null'),
   newSlotId(){let n=1;while(c.slotsList().some(x=>x.id===String(n)))n++;return String(n)},slotMetaOf:(s,id)=>({id,name:s.teams[s.user].name,upd:s.upd}),document:{addEventListener:(n,f)=>events.set(n,f)},
   fetch:async(url,opts)=>{writes.push({url,opts});if(options.switchUser)c.CLOUD.uid='bob';return Response.json({data:JSON.stringify(remote),z:!!options.compressed,version:'v1'})}};
 vm.createContext(c);vm.runInContext(readFileSync(new URL('../cloud-download.js',import.meta.url),'utf8'),c);return {c,storage,remote,old,writes};
}
test('cloud download preserves a conflicting local game, imports without uploads and is idempotent',async()=>{
 const {c,storage,old,writes}=setup({compressed:true});assert.equal(await c.copyCloudToDevice('1'),'cloud-test-copy');assert.deepEqual(JSON.parse(storage.get('save')),old);
 const copy=JSON.parse(storage.get('save:cloud-test-copy'));assert.equal(copy.round,3);assert.equal(copy.players.remote.goals,2);assert.equal(copy.slot,'cloud-test-copy');assert.equal(c.S,null);assert.equal(c.slotsList().length,2);
 assert.equal(await c.copyCloudToDevice('1'),'cloud-test-copy');assert.equal(c.slotsList().length,2);assert.ok(writes.every(x=>!x.opts.method));
});
test('failed persistence and account changes never report or index a successful download',async()=>{
 for(const options of [{fail:true},{switchUser:true}]){const {c,storage,old}=setup(options);assert.equal(await c.copyCloudToDevice('1'),null);assert.equal(c.slotsList().length,1);assert.deepEqual(JSON.parse(storage.get('save')),old)}
});
