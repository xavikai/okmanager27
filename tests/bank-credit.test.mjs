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
test('credit grants cash and records 5 percent interest without allowing a second loan',()=>{
 const c=setup();run(c,`newGame('LIC');S.teams.LIC.budget=-2;bankState().negativeRounds=3;`);
 assert.equal(run(c,'bankBorrow(5)'),true);assert.equal(run(c,'S.teams.LIC.budget'),3);assert.equal(run(c,'bankState().debt'),5.25);assert.equal(run(c,'bankState().negativeRounds'),0);assert.equal(run(c,'bankBorrow(20)'),false);assert.equal(run(c,'S.club.oneoff'),5);
 run(c,'S=JSON.parse(JSON.stringify(S));');assert.equal(run(c,'bankState().debt'),5.25);assert.equal(run(c,'bankBorrow(100)'),false);
});
test('partial and full repayments charge cash once and cannot overdraw the budget',()=>{
 const c=setup();run(c,`newGame('LIC');S.teams.LIC.budget=0;bankBorrow(10);S.teams.LIC.budget=2;`);
 assert.equal(run(c,'bankRepay(5)'),false);assert.equal(run(c,'bankRepay(1)'),true);assert.equal(run(c,'bankState().debt'),9.5);assert.equal(run(c,'S.teams.LIC.budget'),1);
 run(c,'S.teams.LIC.budget=20');assert.equal(run(c,'bankRepay(9.5)'),true);assert.equal(run(c,'S.teams.LIC.budget'),10.5);assert.equal(run(c,'bankState().debt'),0);assert.equal(run(c,'bankRepay(9.5)'),false);assert.equal(run(c,'bankRepay(-1)'),false);assert.equal(run(c,'bankRepay(NaN)'),false);
});
test('negative-budget deadline counts completed rounds once and survives saved games and seasons',()=>{
 const c=setup();run(c,`newGame('LIC');S.teams.LIC.budget=-1;`);
 for(let r=1;r<=5;r++)run(c,`S.round=${r};bankRoundCheck();bankRoundCheck();`);assert.equal(run(c,'bankState().negativeRounds'),5);assert.equal(run(c,'!!S.bankDismissed'),false);
 run(c,'S=JSON.parse(JSON.stringify(S));S.season++;S.round=1;bankRoundCheck()');assert.equal(run(c,'S.bankDismissed'),true);assert.equal(run(c,'S.fired'),true);assert.equal(run(c,'bankBorrow(20)'),false);
});
test('zero or positive cash resets the consecutive-round deadline; insufficient credit does not',()=>{
 const c=setup();run(c,`newGame('LIC');S.teams.LIC.budget=-30;bankState().negativeRounds=4;bankBorrow(20);`);assert.equal(run(c,'bankState().negativeRounds'),4);assert.equal(run(c,'S.teams.LIC.budget'),-10);
 run(c,'S.teams.LIC.budget=0;bankRecover();');assert.equal(run(c,'bankState().negativeRounds'),0);run(c,'S.teams.LIC.budget=-1;S.round=5;bankRoundCheck()');assert.equal(run(c,'bankState().negativeRounds'),1);
});
test('insolvency returns to the menu and loading the closed career cannot resume it',()=>{
 const c=setup();run(c,`newGame('LIC');S.teams.LIC.budget=-1;bankState().negativeRounds=5;S.round=6;bankRoundCheck();globalThis.closed=JSON.parse(JSON.stringify(S));bankDismissToMenu();`);assert.equal(run(c,'S'),null);assert.equal(run(c,'startStep'),'menu');assert.match(run(c,'startScreen()'),/Cessat per insolvència/);assert.equal(run(c,'closed.bankDismissed'),true);
 // Check the production render wrapper, since setup replaces render for engine simulations.
 const html=fs.readFileSync(root+'/index.html','utf8');const a=html.indexOf('const _renderBank=render;'),b=html.indexOf("if(S&&MODE!=='fantasy')render();",a);run(c,html.slice(a,b).replaceAll('_renderBank','_renderBankTest'));run(c,'S=closed;render();');assert.equal(run(c,'S'),null);
});
test('bank movements appear in finances without recharging principal or interest next round',()=>{
 const c=setup();run(c,`newGame('BAR');S.teams.BAR.budget=0;bankBorrow(5);S.club.events=undefined;clubEventState().nextRound=999;R=()=>.5;finances([{h:'BAR',a:'LIC',res:{gh:1,ga:0}}]);`);assert.equal(run(c,'S.ledger[0].extra'),5);assert.equal(run(c,'bankState().debt'),5.25);assert.equal(run(c,'S.club.oneoff'),0);
});

