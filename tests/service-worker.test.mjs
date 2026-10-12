import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
test('service worker never caches private API responses',async()=>{
  const handlers=new Map();let cacheWrites=0,responses=0;
  const context={self:{addEventListener:(name,handler)=>handlers.set(name,handler)},location:{origin:'https://hoquei-manager27.pages.dev'},URL,
    fetch:async()=>new Response('game'),caches:{match:async()=>null,open:async()=>({put(){cacheWrites++}})}};
  vm.createContext(context);vm.runInContext(readFileSync(new URL('../sw.js',import.meta.url),'utf8'),context);
  const pending=[];
  for(const path of ['/api/auth','/api/saves','/api/saves/private'])handlers.get('fetch')({request:new Request(context.location.origin+path),respondWith(value){responses++;pending.push(value)}});
  assert.equal(responses,0);assert.equal(cacheWrites,0);
  handlers.get('fetch')({request:new Request(context.location.origin+'/index.html'),respondWith(value){responses++;pending.push(value)}});
  await Promise.all(pending);assert.equal(responses,1);assert.equal(cacheWrites,1);
});
