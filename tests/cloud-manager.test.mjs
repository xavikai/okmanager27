import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../cloud-manager.js',import.meta.url),'utf8');
async function setup(remote={}) {
  const storage=new Map(),calls=[];const metadata={id:'one',name:'Club',team:'BAR',season:2026,round:0,upd:10000};
  const context={location:{hostname:'hoquei-manager27.pages.dev'},CLOUD:{started:true,uid:null,idx:null},cloudPending:new Map(),cloudTimer:null,cloudRunning:false,cloudNext:0,S:null,LANG:'ca',
    cloudInit(){},cloudIndex(){},cloudLogin(){},cloudFlush(){},cloudPull(){},cloudDelete(){},cloudBlock(){return ''},cloudSchedule(){},render(){},toast(){},
    document:{addEventListener(){}},window:{},clearTimeout(){},W:(a)=>a,esc:x=>x,slotsList:()=>[metadata],slotMetaOf:()=>metadata,gz:async()=>null,
    localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
    fetch:async(url,options)=>{
      if(url==='/api/auth')return Response.json({enabled:true,clientId:'test.apps.googleusercontent.com',user:{id:'alice',name:'Anna'}});
      if(url==='/api/saves')return Response.json({slots:structuredClone(remote)});
      calls.push({url,options});if(options.method==='PUT')return Response.json({version:'new-version'});
      return Response.json({data:'{"season":2026}',z:false,version:remote.one?.version||'new-version'});
    },console,Date,Map,JSON,Promise,Error,encodeURIComponent};
  vm.createContext(context);vm.runInContext(source,context);await new Promise(resolve=>setImmediate(resolve));return {context,calls,storage};
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
