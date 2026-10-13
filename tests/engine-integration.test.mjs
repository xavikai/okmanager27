import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';
const root=new URL('../',import.meta.url).pathname.replace(/^\/(?:([A-Z]:))/,'$1');
function setup(){
const html=fs.readFileSync(root+'/index.html','utf8');
const noop=()=>{};
const el={style:{},dataset:{},classList:{add:noop,remove:noop,contains:()=>false,toggle:noop},querySelector:()=>null,querySelectorAll:()=>[],addEventListener:noop,appendChild:noop,setAttribute:noop,getAttribute:()=>''};
const storage=new Map();
const c={console,Date,TextEncoder,TextDecoder,URL,Blob,Response,fetch:async()=>{throw Error('offline audit')},navigator:{onLine:false,userAgent:'audit'},location:{hostname:'audit',href:'https://audit/'},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},document:{body:el,head:el,documentElement:el,querySelector:()=>el,querySelectorAll:()=>[],getElementById:()=>el,createElement:()=>({...el}),addEventListener:noop},window:{addEventListener:noop,claude:{hot:{snapshot:noop,ready:noop}}},setTimeout:()=>1,clearTimeout:noop,setInterval:()=>1,clearInterval:noop,confirm:()=>true};
vm.createContext(c);
vm.runInContext(fs.readFileSync(root+'/travel-costs.js','utf8'),c);
for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(m[1].trim())vm.runInContext(m[1],c);
vm.runInContext('save=()=>{};render=()=>{};toast=()=>{};',c);
return c;
}
test('real engine completes seasons, cups, save migration and season rollover in four clubs',()=>{
 const c=setup();
 for(const id of ['BAR','LIC','PCPT','FPAL']){
  vm.runInContext(`Math.random=rng(123);newGame('${id}');ageMigration();`,c);
  let steps=0;
  while(vm.runInContext('!S.finished',c)&&steps++<45)vm.runInContext('playRoundFast();',c);
  assert.ok(steps<45,id+' must finish');assert.equal(vm.runInContext('S.round===NROUNDS()',c),true);
  assert.equal(vm.runInContext('Object.values(S.teams).every(t=>Number.isFinite(t.budget))',c),true);
  assert.equal(vm.runInContext('Object.values(S.players).every(p=>Number.isFinite(ovr(p))&&p.energy>=0&&p.energy<=100&&p.inj>=0&&(p.susp||0)>=0)',c),true);
  assert.equal(vm.runInContext('Object.values(S.comp.C).every(c=>c.st==="done")',c),true);
  vm.runInContext('S=migrate(JSON.parse(JSON.stringify(S)));newSeason();',c);
  assert.equal(vm.runInContext('S.season',c),2027);assert.equal(vm.runInContext('S.round',c),0);
  assert.equal(vm.runInContext('Object.keys(S.teams).filter(id=>!S.teams[id].intl).every(id=>{autoFix(id);return validLineup(id)})',c),true);
 }
});
