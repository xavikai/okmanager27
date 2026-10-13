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
test('repairs charge once per round and appear in the same finance ledger',()=>{
 const a=setup(),b=setup();for(const c of [a,b])run(c,`newGame('BAR');R=()=>0;S.teams[S.user].budget=100;clubEventState();`);
 run(a,`S.club.events.nextRound=1`);run(b,`S.club.events.nextRound=999`);
 for(const c of [a,b])run(c,`finances([{h:'BAR',a:'LIC',res:{gh:1,ga:0}}]);`);
 assert.ok(Math.abs(run(b,'S.teams.BAR.budget')-run(a,'S.teams.BAR.budget')-.35)<1e-8);
 assert.ok(Math.abs(run(b,'S.ledger[0].extra')-run(a,'S.ledger[0].extra')-.35)<1e-8);
 const amount=run(a,'S.teams.BAR.budget');run(a,'clubEventTick(1);hubData();hubData()');assert.equal(run(a,'S.teams.BAR.budget'),amount);assert.equal(run(a,'S.club.events.history.length'),1);assert.equal(run(a,"hubData().find(c=>c.k==='club-events').items.length"),1);
});
test('board replacements are automatic, charge admin fees and never enter recruitment',()=>{
 const c=setup();run(c,`newGame('BAR');R=()=>.6;clubEventState();S.club.events.nextRound=1;globalThis.old=S.club.events.board.secretari;globalThis.count=Object.keys(S.players).length;globalThis.budget=S.teams.BAR.budget;clubEventTick(1);`);
 assert.equal(run(c,'S.club.events.board.secretari!==old'),true);assert.equal(run(c,'Object.keys(S.players).length'),run(c,'count'));assert.ok(Math.abs(run(c,'budget-S.teams.BAR.budget')-.1)<1e-8);assert.equal(run(c,'S.club.events.history[0].k'),'board');
});
test('sponsor offers pay only after acceptance and on their agreed round, once',()=>{
 const c=setup();run(c,`newGame('BAR');R=()=>.9;clubEventState();S.club.events.nextRound=1;clubEventTick(1);S.round=1;globalThis.offer=S.club.events.offers[0];globalThis.budget=S.teams.BAR.budget;`);
 assert.equal(run(c,'clubEventOffer(offer.id,true)'),true);assert.equal(run(c,'clubEventOffer(offer.id,true)'),false);assert.equal(run(c,'S.teams.BAR.budget'),run(c,'budget'));
 run(c,'clubEventTick(2)');assert.equal(run(c,'S.teams.BAR.budget'),run(c,'budget'));
 run(c,'S.round=3;clubEventTick(3);clubEventTick(3)');assert.equal(run(c,'S.teams.BAR.budget'),run(c,'budget+offer.amount'));assert.equal(run(c,'S.club.events.contracts[0].paid'),true);
 run(c,'S=JSON.parse(JSON.stringify(S));clubEventTick(3)');assert.equal(run(c,'S.teams.BAR.budget'),run(c,'budget+offer.amount'));
});
test('declined and expired sponsor offers never pay, and new seasons reset the schedule',()=>{
 const c=setup();run(c,`newGame('BAR');R=()=>.9;clubEventState();S.club.events.nextRound=1;clubEventTick(1);S.round=1;globalThis.offer=S.club.events.offers[0];globalThis.budget=S.teams.BAR.budget;`);
 assert.equal(run(c,'clubEventOffer(offer.id,false)'),true);run(c,'clubEventTick(3)');assert.equal(run(c,'S.teams.BAR.budget'),run(c,'budget'));
 run(c,'S.club.events.nextRound=4;S.round=4;clubEventTick(4);globalThis.expired=S.club.events.offers.find(x=>x.status==="pending");S.round=8;clubEventTick(8)');assert.equal(run(c,'clubEventOffer(expired.id,true)'),false);assert.equal(run(c,'expired.status'),'expired');
 run(c,'globalThis.boardName=S.club.events.board.president;S.season++;S.round=0;clubEventState()');assert.equal(run(c,'S.club.events.nextRound'),3);assert.equal(run(c,'S.club.events.offers.length'),0);assert.equal(run(c,'S.club.events.board.president'),run(c,'boardName'));
});

