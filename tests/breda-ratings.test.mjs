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
test('Breda veteran data has one Canaleta and all requested ratings are 63, including after signing',()=>{
 const c=setup();run(c,`newGame('LIC');R=()=>0;const victim=squad(S.user).find(p=>p.pos!=='POR');delete S.players[victim.id];autoFix(S.user);`);
 assert.equal(run(c,`VETS.filter(v=>v[3]==='CP Breda'&&['Joan Canaleta','Juan Canaleta'].includes(v[0])).length`),1);
 for(const name of ['Joan Canaleta','Xavier Caimel','German Porras']){c.__name=name;assert.equal(run(c,'VETS.find(v=>v[0]===__name)[2]'),63);run(c,'vetSign(__name,{sal:0,win:0,tit:false})');assert.equal(run(c,'ovr(Object.values(S.players).find(p=>p.name===__name))'),63)}
});
test('six Macanet youths have the requested starting ratings',()=>{
 const c=setup();run(c,"newGame('MAC')");for(const [id,rating] of [[80224,52],[70683,52],[70703,52],[73937,51],[56933,51],[66308,51]]){assert.equal(run(c,`yCur(YOUTH.find(y=>y[0]===${id}))`),rating)}
});
test('old saved careers merge Canaleta references and update ratings only once',()=>{
 const c=setup();run(c,`newGame('LIC');delete S.bredaRatingsV;const j=makePlayer(['Joan Canaleta','JUG',40,60,'ESP'],S.user,'Vjoan'),u=makePlayer(['Juan Canaleta','JUG',40,61,'ESP'],S.user,'Vjuan');j.vetFrom=u.vetFrom='CP Breda';j.goals=2;u.goals=3;S.players[j.id]=j;S.players[u.id]=u;S.teams.LIC.lineup=['Vjoan','Vjuan'];S.vetUsed=['canaleta juan|JUG|2026'];S.repTalk={'v|canaleta juan|JUG|2026|1':1};S.testReport={ev:[{pid:'Vjuan'}],notes:{Vjuan:7,Vjoan:6}};yState()[70703]={d:2,cess:'JUN'};migrateBredaRatings(S);`);
 assert.equal(run(c,'S.players.Vjuan'),undefined);assert.equal(run(c,'S.players.Vjoan.goals'),5);assert.equal(run(c,'ovr(S.players.Vjoan)'),63);assert.equal(run(c,'S.testReport.ev[0].pid'),'Vjoan');assert.equal(run(c,'S.testReport.notes.Vjoan'),7);assert.equal(run(c,'S.teams.LIC.lineup.length'),5);assert.equal(run(c,'S.vetUsed[0]'),'canaleta joan|JUG|2026');
 run(c,'yApply();');assert.equal(run(c,'yCur(YOUTH.find(y=>y[0]===70703))'),52);assert.equal(run(c,'S.yprog[70703].cess'),'JUN');run(c,'S.yprog[70703].d=1;migrateBredaRatings(S)');assert.equal(run(c,'S.yprog[70703].d'),1);
});
test('new careers do not reset youth progress when first loaded',()=>{const c=setup();run(c,"newGame('MAC');yState()[70703]={d:1};migrateBredaRatings(S)");assert.equal(run(c,'S.yprog[70703].d'),1)});
