import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('function coachBase('),html.indexOf('function coachView(){'));
function setup(){
 const c={S:{user:'BAR',season:2026,club:{coaches:{},coachPool:[],oneoff:0},teams:{BAR:{budget:20}}},COACHES_REAL:[['Eloi Puigalràs','PPAL','A'],['Other Coach','REU','E'],['Third Coach','NOI','A']],CROLES:{ass:{l:'Segon entrenador'},gk:{l:'Entrenador de porters'},youth:{l:'Formació'}},divOf:()=> 'OK',hash:s=>Array.from(s).reduce((h,v)=>(h*31+v.charCodeAt(0))>>>0,0),clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),ri:a=>a,_tx:s=>s,W:s=>s,pushNews:()=>{},toast:()=>{},money:String,saves:0,save(){c.saves++},render:()=>{}};
 vm.createContext(c);vm.runInContext(source,c);return c;
}
const coach=(id,name='Eloi Puigalràs',role='gk')=>({id,name,role,real:1,cost:.1,gk:80});
test('restored saves exclude employed coaches even with different season, role, accents and IDs',()=>{
 const c=setup(),h=coach('old');c.S.club.coaches.gk=h;c.S.club.coachPool=[coach('new','Eloi Puigalras','ass'),coach('next','Eloi Puigalràs','youth'),coach('free','Other Coach','ass')];
 assert.equal(c.coaches().gk,h);assert.equal(c.S.club.coachPool.length,1);assert.equal(c.S.club.coachPool[0].id,'free');
 c.hireCoach('new');assert.equal(c.S.club.coaches.ass,undefined);assert.equal(c.saves,0);
});
test('season renewal and legacy pool regeneration never offer employed people',()=>{
 const c=setup();c.S.club.coaches.gk=coach('old');c.S.season++;
 const pool=c.genCoaches();assert.ok(pool.every(p=>c.coachKey(p.name)!==c.coachKey('Eloi Puigalras')));assert.equal(new Set(pool.map(p=>c.coachKey(p.name))).size,pool.length);
 c.S.club.coachPool=[{id:'legacy',name:'Legacy'}];c.coaches();assert.ok(c.S.club.coachPool.every(p=>c.coachKey(p.name)!==c.coachKey('Eloi Puigalras')));
 c.S.club.coaches.ass=coach('b','Other Coach','ass');c.S.club.coaches.youth=coach('c','Third Coach','youth');assert.equal(c.genCoaches().length,0);
});
test('hiring removes the person in every role; repeated clicks cannot hire them twice',()=>{
 const c=setup();c.S.club.coachPool=[coach('a'),coach('b','Eloi Puigalras','ass'),coach('o','Other Coach','ass')];c.hireCoach('a');
 assert.equal(c.S.club.coaches.gk.name,'Eloi Puigalràs');assert.equal(c.S.club.coachPool.length,1);assert.equal(c.saves,1);c.hireCoach('b');c.hireCoach('a');assert.equal(c.S.club.coaches.ass,undefined);assert.equal(c.saves,1);
});
test('replacement returns the former employee once; firing makes the coach available again',()=>{
 const c=setup(),old=coach('old','Other Coach');c.S.club.coaches.gk=old;c.S.club.coachPool=[coach('new')];c.hireCoach('new');
 assert.equal(c.S.club.coachPool.length,1);assert.equal(c.S.club.coachPool[0],old);c.fireCoach('gk');assert.equal(c.S.club.coaches.gk,undefined);assert.equal(c.S.club.coachPool.length,2);assert.equal(c.S.teams.BAR.budget,19.6);c.fireCoach('gk');assert.equal(c.S.club.coachPool.length,2);
});
test('duplicate free offers are cleaned without removing distinct people',()=>{
 const c=setup();c.S.club.coachPool=[coach('a'),coach('b','Eloi Puigalras','ass'),coach('c','Other Coach','ass')];c.coaches();assert.equal(c.S.club.coachPool.length,2);
});
