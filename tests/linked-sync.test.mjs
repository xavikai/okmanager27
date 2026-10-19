import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const files=['cloud-download.js','cloud-manager.js'].map(f=>readFileSync(new URL('../'+f,import.meta.url),'utf8'));
const tick=()=>new Promise(r=>setImmediate(r));
function server(){const state={slot:'original',user:'SHUM',season:2027,round:10,upd:100,teams:{SHUM:{name:'SHUM'}},players:{real:{name:'Real',goals:3}}};return {slots:new Map([['original',{state,version:'v1'}]]),puts:[],version:1,pause:null};}
async function device(remote,label,seed){
 const storage=new Map(seed||[]),idb=new Map(),events=new Map(),timers=new Map();let seq=0,n=0;
 const c={CLOUD:{started:true},S:null,cloudPending:new Map(),cloudTimer:null,cloudRunning:false,cloudNext:0,location:{hostname:'hoquei-manager27.pages.dev'},navigator:{onLine:true},crypto:{randomUUID:()=>label+'-'+(++seq)},TextEncoder,Blob,URL,console,Date,Map,JSON,Promise,Error,Number,encodeURIComponent,Response,
 W:a=>a,esc:x=>x,toast(){},render(){},migrate:s=>s,gz:async()=>null,gunz:async x=>x,
 cloudInit(){},cloudIndex(){},cloudLogin(){},cloudFlush(){},cloudPull(){},cloudDelete(){},cloudBlock(){return ''},cloudSchedule(){},cloudQueue(){},
 setTimeout(f,d){timers.set(++n,{f,d});return n},clearTimeout(id){timers.delete(id)},setInterval(){},
 document:{visibilityState:'visible',addEventListener(k,f){if(!events.has(k))events.set(k,[]);events.get(k).push(f)}},window:{addEventListener(k,f){if(!events.has(k))events.set(k,[]);events.get(k).push(f)}},
 localStorage:{getItem:k=>storage.get(k)||null,setItem(k,v){storage.set(k,v)}},IDB:{async get(k){return idb.get(k)},async put(k,v){idb.set(k,v)}},SLOTS_KEY:'slots',slotKey:id=>'save:'+id,
 slotsList:()=>JSON.parse(storage.get('slots')||'[]'),loadSlotAsync:async id=>JSON.parse(storage.get('save:'+id)||idb.get('save:'+id)||'null'),
 slotMetaOf:(s,id)=>({id,name:s.teams[s.user].name,team:s.user,season:s.season,round:s.round,upd:s.upd}),save(){if(c.S){c.S.upd++;write(c.S);c.cloudQueue(c.S.slot,JSON.stringify(c.S))}},
 fetch:async(url,options={})=>{if(!c.navigator.onLine)throw Error('offline');
  if(url==='/api/auth')return Response.json({enabled:true,clientId:'test',user:{id:'alice',name:'Owner'}});
  if(url==='/api/saves')return Response.json({slots:Object.fromEntries([...remote.slots].map(([id,r])=>[id,{...c.slotMetaOf(r.state,id),version:r.version}]))});
  const id=decodeURIComponent(url.split('/').pop()),current=remote.slots.get(id);
  if(options.method==='PUT'){const body=JSON.parse(options.body);remote.puts.push({id,body});if(remote.pause)await remote.pause;if((current?.version||null)!==body.version)return Response.json({}, {status:409});const version='v'+(++remote.version);remote.slots.set(id,{state:JSON.parse(body.data),version});return Response.json({version})}
  if(!current)return Response.json({}, {status:404});return Response.json({data:JSON.stringify(current.state),z:false,version:current.version});
 }};
 function write(state){storage.set('save:'+state.slot,JSON.stringify(state));const list=c.slotsList().filter(m=>m.id!==state.slot);list.push(c.slotMetaOf(state,state.slot));storage.set('slots',JSON.stringify(list))}
 vm.createContext(c);for(const f of files)vm.runInContext(f,c);for(let i=0;i<6;i++)await tick();
 return {c,storage,write,events,read:id=>JSON.parse(storage.get('save:'+id)),async edit(id,round){const state=JSON.parse(storage.get('save:'+id));state.round=round;state.upd+=100;write(state);c.cloudQueue(id,JSON.stringify(state));await c.cloudFlush(true);return state}};
}
test('a linked copy always uploads to its original slot, survives restart and never creates a duplicate',async()=>{
 const r=server(),a=await device(r,'a'),id=await a.c.copyCloudToDevice('original');await a.edit(id,11);
 assert.deepEqual([...r.slots.keys()],['original']);assert.equal(r.slots.get('original').state.round,11);assert.equal(r.slots.get('original').state.slot,'original');assert.equal(r.slots.get('original').state.cloudOrigin,undefined);
 assert.equal(a.read(id).cloudOrigin.version,'v2');assert.equal(a.read(id).cloudOrigin.syncedAt,200);assert.equal(await a.c.copyCloudToDevice('original'),id);assert.equal(a.c.slotsList().length,1);
 const restarted=await device(r,'a2',a.storage);assert.equal(restarted.c.slotsList().length,1);assert.equal(restarted.read(id).round,11);assert.equal(await restarted.c.copyCloudToDevice('original'),id);
});
test('switching between two devices automatically pulls newer progress into the same local copy',async()=>{
 const r=server(),a=await device(r,'a'),b=await device(r,'b'),ia=await a.c.copyCloudToDevice('original'),ib=await b.c.copyCloudToDevice('original');
 await b.edit(ib,12);await a.c.cloudPrepareLocal(ia);assert.equal(a.read(ia).round,12);assert.equal(a.c.slotsList().length,1);
 await a.edit(ia,13);await b.c.cloudIndex();assert.equal(b.read(ib).round,13);assert.equal(b.c.slotsList().length,1);assert.equal(r.slots.size,1);
});
test('offline divergence preserves both versions, blocks stale writes and keeps a recoverable local backup',async()=>{
 const r=server(),a=await device(r,'a'),b=await device(r,'b'),ia=await a.c.copyCloudToDevice('original'),ib=await b.c.copyCloudToDevice('original');
 a.c.navigator.onLine=false;await a.edit(ia,14);await b.edit(ib,15);const writes=r.puts.length;
 a.c.navigator.onLine=true;for(const f of a.events.get('online'))await f();await tick();assert.equal(r.puts.length,writes);assert.equal(a.read(ia).round,14);assert.equal(r.slots.get('original').state.round,15);assert.match(a.c.cloudConflictPanel(),/No s’ha sobreescrit/);
 await a.c.cloudUseRemote(ia);assert.equal(a.read(ia).round,15);assert.equal(a.c.slotsList().length,1);const backups=a.c.cloudBackupIndex();assert.equal(backups.length,1);assert.equal(JSON.parse(a.storage.get(backups[0].key)).round,14);
 await a.edit(ia,16);assert.equal(r.slots.get('original').state.round,16);assert.equal(r.slots.size,1);
});
test('progress saved during an in-flight upload receives the acknowledged base version',async()=>{
 const r=server(),a=await device(r,'a'),id=await a.c.copyCloudToDevice('original');let release;r.pause=new Promise(resolve=>release=resolve);
 const first=a.edit(id,11);await tick();const second=a.read(id);second.round=12;second.upd=300;a.write(second);a.c.cloudQueue(id,JSON.stringify(second));release();r.pause=null;await first;await a.c.cloudFlush(true);
 assert.equal(r.slots.get('original').state.round,12);assert.equal(r.slots.size,1);assert.equal(a.read(id).cloudOrigin.version,'v3');assert.equal(a.read(id).round,12);
});
test('a newer remote version cannot replace an active local game or upload through another account',async()=>{
 const r=server(),a=await device(r,'a'),b=await device(r,'b'),ia=await a.c.copyCloudToDevice('original'),ib=await b.c.copyCloudToDevice('original');
 a.c.S=a.read(ia);await b.edit(ib,12);await a.c.cloudIndex();assert.equal(a.c.S.round,10);assert.equal(a.read(ia).round,10);assert.match(a.c.cloudConflictPanel(),/No s’ha sobreescrit/);
 const writes=r.puts.length;a.c.CLOUD.uid='bob';a.c.cloudQueue(ia,JSON.stringify(a.read(ia)));await a.c.cloudFlush(true);assert.equal(r.puts.length,writes);
});
test('v49 downloaded copies acquire their link automatically without changing their slot or progress',async()=>{
 const r=server(),state=structuredClone(r.slots.get('original').state);state.slot='cloud-existing';state.cloudOrigin={user:'alice',slot:'original',version:'v1'};const seed=new Map([['save:cloud-existing',JSON.stringify(state)],['slots',JSON.stringify([{id:'cloud-existing',upd:100}])]]);
 const a=await device(r,'a',seed);assert.equal(a.read('cloud-existing').cloudOrigin.syncedAt,100);assert.equal(a.c.slotsList().length,1);await a.edit('cloud-existing',11);assert.equal(r.slots.size,1);assert.equal(r.slots.get('original').state.round,11);
});
test('changes sharing a timestamp still conflict safely when another device has advanced',async()=>{
 const r=server(),a=await device(r,'a'),b=await device(r,'b'),ia=await a.c.copyCloudToDevice('original'),ib=await b.c.copyCloudToDevice('original');
 const local=a.read(ia);local.round=11;local.upd=100;a.write(local);await b.edit(ib,12);await a.c.cloudIndex();assert.equal(a.read(ia).round,11);assert.equal(r.slots.get('original').state.round,12);assert.match(a.c.cloudConflictPanel(),/No s’ha sobreescrit/);
});
test('server revision rejection preserves offline progress even when the index was stale',async()=>{
 const r=server(),a=await device(r,'a'),b=await device(r,'b'),ia=await a.c.copyCloudToDevice('original'),ib=await b.c.copyCloudToDevice('original');
 await b.edit(ib,12);await a.edit(ia,13);assert.equal(a.read(ia).round,13);assert.equal(r.slots.get('original').state.round,12);assert.match(a.c.cloudConflictPanel(),/No s’ha sobreescrit/);assert.equal(a.c.slotsList().length,1);
});
