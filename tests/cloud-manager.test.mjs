import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../cloud-manager.js',import.meta.url),'utf8');
async function setup(remote={},options={}) {
  const storage=new Map(),calls=[],timers=new Map(),events=new Map();let timerId=0;const metadata={id:'one',name:'Club',team:'BAR',season:2026,round:0,upd:10000};
  if(options.version)storage.set('hm27-cloud-versions-alice',JSON.stringify({one:options.version}));
  const context={location:{hostname:'hoquei-manager27.pages.dev'},CLOUD:{started:true,uid:null,idx:null},cloudPending:new Map(),cloudTimer:null,cloudRunning:false,cloudNext:0,S:null,LANG:'ca',
    cloudInit(){},cloudIndex(){},cloudLogin(){},cloudFlush(){},cloudPull(){},cloudDelete(){},cloudBlock(){return ''},cloudSchedule(){},cloudQueue(){},render(){},toast(){},
    document:{visibilityState:'visible',addEventListener(name,callback){events.set(name,callback)}},window:{addEventListener(name,callback){events.set(name,callback)}},setTimeout(callback,delay){const id=++timerId;timers.set(id,{callback,delay});return id},clearTimeout(id){timers.delete(id)},navigator:{onLine:true},TextEncoder,W:(a)=>a,esc:x=>x,slotsList:()=>[metadata],slotMetaOf:()=>metadata,gz:async()=>null,
    save(){if(context.S)context.cloudQueue(context.S.slot,JSON.stringify(context.S))},loadSlotAsync:async()=>({slot:'one',season:2026}),
    localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
    fetch:async(url,options)=>{
      if(url==='/api/auth')return Response.json({enabled:true,clientId:'test.apps.googleusercontent.com',user:{id:'alice',name:'Anna'}});
      if(url==='/api/saves')return Response.json({slots:structuredClone(remote)});
      calls.push({url,options});if(options.method==='PUT')return Response.json({version:'new-version'});
      return Response.json({data:'{"season":2026}',z:false,version:remote.one?.version||'new-version'});
    },console,Date,Map,JSON,Promise,Error,encodeURIComponent};
  vm.createContext(context);vm.runInContext(source,context);await new Promise(resolve=>setImmediate(resolve));return {context,calls,storage,timers,events};
}
test('client saves and remembers the revision; unknown cloud revision requires pulling first',async()=>{
  const {context,calls,storage}=await setup();
  context.cloudPending.set('one',{slot:'one',j:'{"season":2026}',uid:'alice'});await context.cloudFlush(true);
  assert.equal(calls.length,1);assert.equal(JSON.parse(calls[0].options.body).version,null);
  assert.equal(JSON.parse(storage.get('hm27-cloud-versions-alice')).one,'new-version');
  context.cloudPending.set('one',{slot:'one',j:'{"season":2026}',uid:'alice'});await context.cloudFlush(true);
  assert.equal(JSON.parse(calls[1].options.body).version,'new-version');
  const blocked=await setup({one:{id:'one',name:'Club',upd:10000,version:'remote-version'}});
  blocked.context.cloudPending.set('one',{slot:'one',j:'{"season":2026}',uid:'alice'});await blocked.context.cloudFlush(true);
  assert.equal(blocked.calls.length,0);assert.match(blocked.context.CLOUD.msg,/encara no ha carregat/);
  await blocked.context.cloudPull('one');
  blocked.context.cloudPending.set('one',{slot:'one',j:'{"season":2026}',uid:'alice'});await blocked.context.cloudFlush(true);
  assert.equal(JSON.parse(blocked.calls.at(-1).options.body).version,'remote-version');
});
test('pending saves for a different account are ignored',async()=>{
  const {context,calls}=await setup();context.cloudPending.set('one',{slot:'one',j:'{}',uid:'bob'});await context.cloudFlush(true);assert.equal(calls.length,0);
});
test('automatic saves group edits and send the latest snapshot after five seconds',async()=>{
  const {context,calls,timers}=await setup();context.cloudQueue('one','{"round":1}');context.cloudQueue('one','{"round":2}');
  assert.equal(timers.size,1);const timer=timers.values().next().value;assert.equal(timer.delay,5000);await timer.callback();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(calls.length,1);assert.equal(JSON.parse(calls[0].options.body).data,'{"round":2}');assert.equal(calls[0].options.keepalive,true);
});
test('backgrounding bypasses the normal interval and offline data retries on reconnect',async()=>{
  const {context,calls,events}=await setup();context.cloudNext=Date.now()+30000;context.S={slot:'one',round:4};context.document.visibilityState='hidden';events.get('visibilitychange')();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(calls.length,1);assert.equal(JSON.parse(calls[0].options.body).data,'{"slot":"one","round":4}');
  const originalFetch=context.fetch;let fail=true;context.fetch=async(url,options)=>{if(url.includes('/saves/')&&fail)throw Error('offline');return originalFetch(url,options)};
  context.navigator.onLine=false;context.cloudQueue('one','{"round":5}');await context.cloudFlush(true);assert.equal(context.cloudPending.size,1);
  fail=false;context.navigator.onLine=true;context.S=null;await events.get('online')();await new Promise(resolve=>setImmediate(resolve));assert.equal(context.cloudPending.size,0);assert.equal(JSON.parse(calls.at(-1).options.body).data,'{"round":5}');
});
test('a final snapshot follows an in-flight save without overwriting it out of order',async()=>{
  const {context,calls,events}=await setup();const originalFetch=context.fetch;let release;const blocked=new Promise(resolve=>{release=resolve});let first=true;
  context.fetch=async(url,options)=>{if(url.includes('/saves/')&&first){first=false;await blocked}return originalFetch(url,options)};
  context.cloudQueue('one','{"round":1}');const saving=context.cloudFlush(true);await new Promise(resolve=>setImmediate(resolve));context.S={slot:'one',round:2};events.get('pagehide')();release();await saving;await new Promise(resolve=>setImmediate(resolve));
  assert.equal(calls.length,2);assert.equal(JSON.parse(calls[1].options.body).data,'{"slot":"one","round":2}');assert.equal(JSON.parse(calls[1].options.body).version,'new-version');
});
test('large saves do not request keepalive beyond browser body limits',async()=>{
  const {context,calls}=await setup();context.cloudQueue('one',JSON.stringify({data:'x'.repeat(65000)}));await context.cloudFlush(true);assert.equal(calls[0].options.keepalive,false);
});
test('restart resumes a newer local save only when its account revision matches',async()=>{
  const remote={one:{id:'one',name:'Club',upd:9000,version:'owned-revision'}};
  const own=await setup(remote,{version:'owned-revision'});assert.equal(own.context.cloudPending.size,1);
  const other=await setup(remote,{version:'different-revision'});assert.equal(other.context.cloudPending.size,0);
});
