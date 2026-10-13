import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';
const root=new URL('../',import.meta.url).pathname.replace(/^\/(?:([A-Z]:))/,'$1');
function setup(){
 const html=fs.readFileSync(root+'/index.html','utf8');const noop=()=>{};
 const el={style:{},dataset:{},classList:{add:noop,remove:noop,contains:()=>false,toggle:noop},querySelector:()=>null,querySelectorAll:()=>[],addEventListener:noop,appendChild:noop,setAttribute:noop,getAttribute:()=>''};
 const storage=new Map();
 const c={console,Date,TextEncoder,TextDecoder,URL,Blob,Response,fetch:async()=>{throw Error('offline')},navigator:{onLine:false,userAgent:'test'},location:{hostname:'test',href:'https://test/'},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},document:{body:el,head:el,documentElement:el,querySelector:()=>el,querySelectorAll:()=>[],getElementById:()=>el,createElement:()=>({...el}),addEventListener:noop},window:{addEventListener:noop,claude:{hot:{snapshot:noop,ready:noop}}},setTimeout:()=>1,clearTimeout:noop,setInterval:()=>1,clearInterval:noop,confirm:()=>true};
 vm.createContext(c);
 vm.runInContext(fs.readFileSync(root+'/travel-costs.js','utf8'),c);
 for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(m[1].trim())vm.runInContext(m[1],c);
 vm.runInContext('save=()=>{};render=()=>{};toast=()=>{};',c);
 return c;
}
const run=(c,js)=>vm.runInContext(js,c);
test('grouped menu keeps every original section and shows tabs only inside multi-section groups',()=>{
 const c=setup();run(c,`Math.random=rng(7);newGame('BAR');`);
 const items=run(c,`[["inici","Despatx"],["plantilla","Plantilla"],["alineacio","Alineació"],["entrenament","E"],["joves","J"],["cos","C"],["calendari","Cal"],["classificacio","Cl"],["comp","Co"],["resum","R"],["estadistiques","Es"],["vitrina","V"],["sep"],["mercat","M"],["exjug","X"],["oficina","O",2],["equips","Eq"],["finances","F"],["club","Cb"],["sep"],["opcions","P"],["nou","Nou"]]`);
 c.__items=items;
 const nav=run(c,`view="inici";hubNav(__items)`);
 for(const k of ['inici','plantilla','calendari','mercat','cos','opcions','nou'])assert.match(nav,new RegExp(`data-v="${k}"`),k);
 assert.equal(run(c,`view="inici";hubTabs(__items)`),'');
 const tabs=run(c,`view="exjug";hubTabs(__items)`);
 for(const k of ['mercat','exjug','oficina'])assert.match(tabs,new RegExp(`data-v="${k}"`));
 assert.match(run(c,`hubNav(__items)`),/class="hubsubs"/);
 assert.match(run(c,`view="classificacio";hubLabel(__items)`),/data-ui-icon="ranking"/);
});
test('alerts list injuries, bans, personal problems, offers, unhappy players and coaches; seen items are no longer new',()=>{
 const c=setup();run(c,`Math.random=rng(11);newGame('PCPT');`);
 run(c,`const sq=squad(S.user);sq[1].inj=3;sq[2].susp=2;sq[3].issue={t:"x",left:2,talked:-1};
  const o=Object.keys(S.teams).find(t=>t!==S.user&&sameG(t,S.user)&&divOf(t)!=="INT");S.offers.push({id:"oT",pid:sq[4].id,from:o,amt:5});wantsRound(6);`);
 const k=run(c,`hubData().map(x=>x.k).join(",")`);
 for(const x of ['inj','sus','iss','off'])assert.ok(k.includes(x),k);
 assert.ok(run(c,`hubFresh().length`)>=4);
 run(c,`hubMarkSeen(hubData())`);
 assert.equal(run(c,`hubFresh().length`),0);
 run(c,`squad(S.user)[5].inj=2`);
 assert.equal(run(c,`hubFresh().length`),1);
 assert.equal(run(c,`hubData().filter(x=>x.k==="coach").every(x=>new Set(x.items.map(i=>i.key)).size===x.items.length)`),true);
});
test('treatments shorten injuries once each, cost money and forced returns can relapse',()=>{
 const c=setup();run(c,`Math.random=rng(5);newGame('BAR');`);
 run(c,`globalThis.P=squad(S.user).find(p=>p.pos!=="POR");P.inj=5;S.teams[S.user].budget=100;`);
 for(const rep of [1,2,3,4,5])for(const fisio of [0,1,2]){run(c,`S.teams[S.user].rep=${rep};S.club.staff.fisio=${fisio}`);assert.equal(run(c,`treatOpts(P).find(o=>o.k==='fis').cost`),.25);assert.equal(run(c,`treatOpts(P).find(o=>o.k==='cli').cost`),.5)}
 const b0=run(c,`S.teams[S.user].budget`);
 run(c,`treatApply(P.id,"fis")`);
 assert.equal(run(c,`P.inj`),4);assert.equal(run(c,`S.teams[S.user].budget`),b0-.25);
 run(c,`treatApply(P.id,"fis")`);assert.equal(run(c,`P.inj`),4,'fisio only once per injury');
 run(c,`treatApply(P.id,"cli")`);assert.equal(run(c,`P.inj`),2);assert.equal(run(c,`S.teams[S.user].budget`),b0-.75);
 run(c,`treatApply(P.id,"for")`);assert.equal(run(c,`P.inj`),0);assert.equal(run(c,`avail(P)`),true);
 assert.equal(run(c,`!!P.forced`),true);
 let steps=0;while(run(c,`!!P.forced&&!S.finished`)&&steps++<6)run(c,`autoFix(S.user);playRoundFast()`);
 assert.equal(run(c,`!!P.forced`),false,'risk window closes');
 assert.equal(run(c,`P.inj>=0&&Number.isFinite(S.teams[S.user].budget)`),true);
 run(c,`S.teams[S.user].budget=0;P.inj=4;P.treat=null`);
 assert.equal(run(c,`treatOpts(P).filter(o=>o.cost>0).every(o=>!o.ok)`),true,'no money, no paid treatment');
});
test('a full season still completes with the alert hooks active',()=>{
 const c=setup();run(c,`Math.random=rng(99);newGame('LIC');`);
 let steps=0;while(run(c,'!S.finished')&&steps++<45){run(c,`for(const p of squad(S.user))if(p.inj>=2&&!(p.treat&&p.treat.cli))treatApply(p.id,p.inj>=3?"cli":"for");playRoundFast();hubData();`)}
 assert.ok(steps<45);assert.equal(run(c,'S.round===NROUNDS()'),true);
 assert.equal(run(c,'Object.values(S.players).every(p=>p.inj>=0)'),true);
});
