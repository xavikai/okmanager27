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

test('Tercera players who are also juvenils appear in the Juvenil filter, without being locked',()=>{
 const c=setup();run(c,`Math.random=rng(1);newGame('MAC');yApply();`);
 assert.equal(run(c,`YJUV[40651]`),'JVO','Sergi Munso is also Juvenil Or');
 run(c,`ui.yLv="JVO"`);const h=run(c,`youthView()`);
 assert.match(h,/Sergi Munso/);assert.match(h,/També Juvenil Or/);
 assert.match(h,/Juvenil Or \((\d+)\)/);assert.ok(+h.match(/Juvenil Or \((\d+)\)/)[1]>=15);
 assert.equal(run(c,`juvLock(YOUTH.find(y=>y[0]===40651))`),null);
 assert.equal(Object.keys(run(c,'YJUV')).length,312);
});
test('juvenils with infantil age are 14, labelled, and their ratings stay in the infantil band',()=>{
 const c=setup();run(c,`Math.random=rng(2);newGame('MAC');yApply();`);
 assert.equal(run(c,'YINF.size'),285);
 const joel=run(c,`(()=>{const y=YOUTH.find(y=>y[1]==="Joel Bancells");return JSON.stringify([yAge(y),y[7],YINF.has(y[0])])})()`);
 assert.equal(joel,"[14,53,true]");
 assert.equal(run(c,`YOUTH.filter(y=>y[3]==="JVO"&&!YINF.has(y[0])).every(y=>y[7]>=55&&y[7]<=58)`),true);
 assert.equal(run(c,`YOUTH.filter(y=>y[3]==="JVP"&&!YINF.has(y[0])).every(y=>y[7]>=49&&y[7]<=52)`),true);
 assert.equal(run(c,`YOUTH.filter(y=>y[3]==="JVO"&&YINF.has(y[0])).every(y=>y[7]>=49&&y[7]<=54)`),true);
 assert.equal(run(c,`YOUTH.filter(y=>y[3]==="JVP"&&YINF.has(y[0])).every(y=>y[7]>=44&&y[7]<=48)`),true);
 assert.match(run(c,`ui.yLv="JVO";youthView()`),/Edat d'infantil/);
 assert.match(run(c,`juvLock(YOUTH.find(y=>y[1]==="Joel Bancells"))`),/2030-31/);
 assert.equal(run(c,`ycap(YOUTH.find(y=>y[3]==="JVO"&&!YINF.has(y[0])))`),58);
});
test('Lliga Catalana uses the official calendar, also for saves that have not started it',()=>{
 const c=setup();run(c,`Math.random=rng(3);newGame('MAC');`);
 const md=run(c,`JSON.stringify(catCurrent().md)`);
 assert.equal(md,JSON.stringify(run(c,'LCAT_MD')));
 assert.deepEqual(run(c,`catBatch(catCurrent()).find(m=>m.h==="MAC"||m.a==="MAC")`).h,'CAL');
 run(c,`const k=catCurrent();k.md=Object.fromEntries(Object.entries(k.groups).map(([g,ids])=>[g,catRoundRobin(ids)]));delete k.official;`);
 assert.equal(run(c,`JSON.stringify(catCurrent().md)`),JSON.stringify(run(c,'LCAT_MD')),'old saves get the official calendar');
 run(c,`{const k=catCurrent();catPrepareRound(k);catPlayRound(k);k.md.C[1]=[["MAC","REU"],["CAL","CLD"]];}`);
 assert.equal(run(c,`catCurrent().md.C[1][0][0]`),'MAC','a started cup keeps its calendar');
});
test('veterans and comebacks can renew for one more season',()=>{
 const c=setup();run(c,`Math.random=rng(4);newGame('MAC');S.comp=null;`);
 run(c,`globalThis.V=squad(S.user)[5];V.vet="V";V.vetFrom="CE Noia Veterans";V.apps=20;V.morale=90;globalThis.Q=squad(S.user)[6];Q.comeback=S.season;Q.apps=15;Q.morale=80;`);
 let n=0;while(run(c,'!S.finished')&&n++<40)run(c,'playRoundFast()');
 assert.equal(run(c,`vetRenewList().map(p=>p.id).sort().join()`),run(c,`[V.id,Q.id].sort().join()`));
 assert.match(run(c,'vetRenewPanel()'),/Final de contracte/);
 run(c,`R=()=>0;globalThis.__s=V.salary;vetRenew(V.id,"pay");vetRenew(Q.id,"same");R=Math.random;`);
 assert.equal(run(c,`V.retiring||Q.retiring`),false);
 assert.equal(run(c,`Math.round(V.salary*100)===Math.round(__s*120)`),true);
 run(c,`newSeason()`);
 assert.equal(run(c,`!!S.players[V.id]&&!!S.players[Q.id]`),true,'both stay');
 assert.equal(run(c,`S.players[V.id].vet==="V"&&S.players[Q.id].comeback===S.season`),true,'keep their status');
});
test('without a decision they leave as before',()=>{
 const c=setup();run(c,`Math.random=rng(5);newGame('MAC');S.comp=null;globalThis.V=squad(S.user)[5];V.vet="V";V.vetFrom="X";`);
 let n=0;while(run(c,'!S.finished')&&n++<40)run(c,'playRoundFast()');
 run(c,`newSeason()`);assert.equal(run(c,`!!S.players[V.id]`),false);
});
