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
const start=(c,id,seed)=>run(c,`Math.random=rng(${seed});newGame('${id}');yApply();S.teams[S.user].budget=500;`);

test('market lists one entry per person, none from our club and none already in a first team',()=>{
 const c=setup();start(c,'MAC',1);
 assert.equal(run(c,`(()=>{const L=ymList();const ks=L.map(yPersonKey);return new Set(ks).size===ks.length})()`),true,'no duplicate people');
 assert.equal(run(c,`ymList().some(y=>y[2]===yClub(S.user))`),false);
 assert.equal(run(c,`(()=>{const t=ymTaken();return ymList().some(y=>t.has(yNorm(y[1])))})()`),false);
 assert.equal(run(c,`(()=>{const mine=new Set(youthOf(S.user).map(yPersonKey));return ymList().some(y=>mine.has(yPersonKey(y)))})()`),false,'people of our own academy are not on sale');
 assert.ok(run(c,`ymList().filter(y=>["JOR","JPL","JUN","JVO","JVP"].includes(y[3])).length`)>200);
});

test('signing moves the player to our academy once, charges the fee and blocks his duplicate entries',()=>{
 const c=setup();start(c,'MAC',2);
 // a person that appears in two clubs, both outside ours
 const id=run(c,`(()=>{for(const [k,ids] of yPersons())if(ids.length>1){const ys=ids.map(i=>YOUTH.find(y=>y[0]===i));if(ys.every(y=>y[2]!==yClub(S.user))&&ymList().some(y=>ids.includes(y[0])))return ymList().find(y=>ids.includes(y[0]))[0]}return null})()`);
 assert.ok(id,'a duplicated person exists in the data');
 c.__id=id;
 run(c,`R=()=>0;globalThis.__b=S.teams[S.user].budget;globalThis.__fee=ymFee(YOUTH.find(y=>y[0]===__id));ySign(__id)`);
 assert.equal(run(c,`youthOf(S.user).some(y=>y[0]===__id)`),true);
 assert.equal(run(c,`Math.round((__b-S.teams[S.user].budget)*100)/100===__fee`),true);
 assert.equal(run(c,`(()=>{const y=YOUTH.find(y=>y[0]===__id);return ymList().some(x=>yPersonKey(x)===yPersonKey(y))})()`),false,'gone from the market, including the other entry');
 assert.equal(run(c,`(()=>{const y=YOUTH.find(y=>y[0]===__id);return (yPersons().get(yPersonKey(y))).filter(i=>i!==__id).every(i=>yst(i).out&&yst(i).up)})()`),true,'duplicate cannot be promoted by its other club');
 assert.equal(run(c,`(()=>{const y=YOUTH.find(y=>y[0]===__id);return YOUTH.filter(x=>yPersonKey(x)===yPersonKey(y)&&youthOf(x[2]).some(z=>z[0]===x[0])).length})()`),1,'he is in exactly one academy');
 // save and reload restores the move
 run(c,`Math.random=rng(5);globalThis.__save=JSON.stringify(S);newGame('BAR');yApply();`);
 assert.equal(run(c,`YOUTH.find(y=>y[0]===__id)[2]===YOUTH0.find(y=>y[0]===__id)[2]`),true,'other careers see the original club');
 run(c,`S=migrate(JSON.parse(__save));yApply();`);
 assert.equal(run(c,`youthOf(S.user).some(y=>y[0]===__id)`),true,'reloaded career keeps the signing');
 // promote: one first-team player, not available elsewhere
 run(c,`for(const p of squad(S.user).slice(0,3))delete S.players[p.id];const y=YOUTH.find(y=>y[0]===__id);if(isJuv(y)){yst(__id).sen=1;y[7]=Math.max(y[7],62)}promoteYouth(__id)`);
 assert.equal(run(c,`(()=>{const y=YOUTH.find(y=>y[0]===__id);return Object.values(S.players).filter(p=>yNorm(p.name)===yNorm(y[1])).length})()`),1);
});

test('limits: one try per round, four signings per season, budget required',()=>{
 const c=setup();start(c,'MAC',3);
 run(c,`R=()=>.999;globalThis.__L=ymList().slice(0,8).map(y=>y[0]);ySign(__L[0])`);
 assert.equal(run(c,`!!yst(__L[0]).to`),false,'refused');
 run(c,`R=()=>0;ySign(__L[0])`);
 assert.equal(run(c,`!!yst(__L[0]).to`),false,'cannot ask again in the same round');
 run(c,`for(const id of __L.slice(1))ySign(id)`);
 assert.equal(run(c,`ymSignedThisSeason()`),4);
 run(c,`S.season++;S.teams[S.user].budget=0;ySign(__L[7])`);
 assert.equal(run(c,`!!yst(__L[7]).to`),false,'no money');
});

test('juniors can be loaned, including to OK Liga Plata with a real destination club',()=>{
 const c=setup();start(c,'MAC',4);
 run(c,`R=()=>0;globalThis.__j=ymList().find(y=>y[3]==="JOR"&&yCur(y)>=62);ySign(__j[0]);`);
 assert.match(run(c,`yActions(YOUTH.find(y=>y[0]===__j[0]))`),/data-ycess=/);
 run(c,`setCess(__j[0],"PL")`);
 assert.equal(run(c,`yst(__j[0]).cess`),'PL');
 assert.equal(run(c,`Object.values(S.teams).some(t=>t.name===yst(__j[0]).cteam&&["PN","PS"].includes(divOf(t.id)))`),true);
 const d0=run(c,`yst(__j[0]).d||0`);
 run(c,`for(let i=0;i<40;i++)youthRound()`);
 assert.ok(run(c,`yst(__j[0]).d||0`)>d0,'loan makes him grow');
 run(c,`globalThis.__low=ymList().find(y=>y[3]==="JPL"&&yCur(y)<58);ySign(__low[0]);setCess(__low[0],"NAC")`);
 assert.equal(run(c,`!!yst(__low[0]).cess`),false,'Nacional needs a minimum level');
});

test('a youth that our academy shares with another club is blocked there',()=>{
 const c=setup();
 const ok=run(c,`(()=>{for(const [k,ids] of yPersons()){if(ids.length<2)continue;const ys=ids.map(i=>YOUTH0.find(y=>y[0]===i));const t=Object.values(ALLTEAMS).find(t=>ys.some(y=>y[2]===t.id));if(t)return [t.id,ids]}return null})()`);
 assert.ok(ok);c.__ok=ok;
 run(c,`Math.random=rng(9);newGame(__ok[0]);yApply();`);
 assert.equal(run(c,`__ok[1].filter(i=>YOUTH.find(y=>y[0]===i)[2]!==yClub(S.user)).every(i=>yst(i).out)`),true);
});
