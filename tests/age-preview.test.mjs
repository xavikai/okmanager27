import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const between=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const aging=between('function ageGrowth(','/* Fi progressió per edat */');
const preview=between('function matchPreviewNext(','/* Fi vista prèvia */');
const ratings=between('function ovr(p){','/* Sous (estimats)');
const player=(name,age,rating=81,pos='JUG')=>({id:name,name,age,pos,team:'BAR',nat:'ESP',a:Object.fromEntries(['pat','tec','xut','def','fis','ref','col'].map(k=>[k,rating])),energy:100,salary:3,contract:2030,apps:9});
function ageSetup(players){
 const news=[],c={S:{season:2026,round:0,user:'BAR',teams:{BAR:{}},players:Object.fromEntries(players.map(p=>[p.id,p])),offers:[]},ALLTEAMS:[{id:'BAR',p:[['Ignacio Alabart','JUG',30,92,'ESP']]}],TEAMS_INT:[],rosterName:s=>s.toLowerCase().replace(/[^a-z]/g,''),clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),ri:(a,b)=>b,hash:()=>1,openWindow:()=>{},clubNewSeason:()=>{},applyMoves:()=>{},makeFixtures:()=>[],autoLineup:()=>{},pushNews:m=>news.push(m),_tx:s=>s,newChallenge:()=>{},save:()=>{},render:()=>{},balFix:()=>{},W:s=>s,squad:()=>Object.values(c.S.players),makePlayer:a=>player(a[0],a[2],a[3],a[1]),rateMatch(m){for(const id of [...m.res.lh,...m.res.la]){const p=c.S.players[id];for(const k in p.a)p.a[k]+=10;p.apps++}return {kept:true}},trainRound(){for(const p of Object.values(c.S.players))for(const k in p.a)p.a[k]+=10}};
 vm.createContext(c);vm.runInContext(ratings+html.match(/function newSeason\(\){[\s\S]*?\n}/)[0]+aging,c);return {c,news};
}
test('training and good performances share a cap; veterans gain no attributes in either route',()=>{
 const old=player('Veteran',35),young=player('Young',22),c=ageSetup([old,young]).c;
 c.trainRound();c.rateMatch({res:{lh:[old.id,young.id],la:[]}});assert.equal(c.ovr(old),81);assert.equal(old.a.ref,81);assert.equal(c.ovr(young),84);assert.equal(young.apps,10);
 for(let i=0;i<40;i++){c.trainRound();c.rateMatch({res:{lh:[old.id,young.id],la:[]}})}assert.equal(c.ovr(old),81);assert.equal(c.ovr(young),84);
});
test('a thirty-year-old rated 81 cannot turn into 90 over repeated seasons, including goalkeepers',()=>{
 for(const pos of ['JUG','POR']){const p=player('Veteran',30,81,pos),c=ageSetup([p]).c;
  for(let y=0;y<10;y++){for(let i=0;i<26;i++){c.trainRound();c.rateMatch({res:{lh:[p.id],la:[]}})}c.newSeason();assert.ok(c.ovr(p)<=81)}
  assert.equal(p.age,40);assert.ok(c.ovr(p)<81);
 }
});
test('new-season gains also consume the shared annual allowance for young players',()=>{
 const p=player('Young',23),c=ageSetup([p]).c;c.newSeason();for(let i=0;i<50;i++){c.trainRound();c.rateMatch({res:{lh:[p.id],la:[]}})}assert.ok(c.ovr(p)<=84);
});
test('Alabart is Spanish in old saves and future signings; migration corrects known inflated veterans once',()=>{
 const p=player('Ignacio Alabart',35,99);p.nat='ARG';const {c,news}=ageSetup([p]);c.render();assert.equal(p.nat,'ESP');assert.ok(c.ovr(p)<92);assert.equal(p.salary,3);assert.equal(p.contract,2030);assert.equal(p.apps,9);assert.equal(news.length,1);
 const a=c.ovr(p);c.render();assert.equal(c.ovr(p),a);assert.equal(news.length,1);assert.equal(c.makePlayer(['Ignacio Alabart','JUG',30,92,'ARG'],'BAR','x').nat,'ESP');
 const literal=vm.runInNewContext(html.match(/const TEAMS0=(\[[\s\S]*?\]);/)[1],{_tx:s=>s});assert.equal(literal.find(t=>t.id==='BAR').p.find(p=>p[0]==='Ignacio Alabart')[4],'ESP');
});
function previewSetup(){
 const buttons={},events={},nodes=[],c={S:{user:'BAR',round:0,teams:{BAR:{id:'BAR',name:'Our club',lineup:['b1','b2','b3','b4','b5']},LIC:{id:'LIC',name:'Opponent',lineup:['l1','l2','l3','l4','l5']}},players:{}},ui:{},view:'inici',ticker:null,cup:null,catCurrent:()=>c.cup,catBatch:()=>[{h:'LIC',a:'BAR'}],COMPS:{LCAT:{n:()=> 'Lliga Catalana'}},catStage:()=> 'Group 1',FX:()=>[[{h:'BAR',a:'LIC'}]],myDiv:()=> 'OK',DIVS:{OK:'OK Liga'},squad:id=>Object.values(c.S.players).filter(p=>p.team===id),pos:s=>s,ovr:p=>p.rating,esc:s=>s,W:s=>s,shield:()=>'',autoFix:()=>{},catPrepareRound:()=>{},calls:{play:0,render:0,run:0},playRound(){c.calls.play++;c.view='partit';c.ui.match={m:{}}},render(){c.calls.render++},runMatchView(){c.calls.run++},document:{getElementById:()=>null,addEventListener:(e,f)=>events[e]=f,body:{appendChild:n=>nodes.push(n)},createElement:()=>({style:{},setAttribute(){},addEventListener(){},showModal(){},remove(){},querySelector(selector){return buttons[selector]||(buttons[selector]={focus(){}})}})}};
 for(const team of ['BAR','LIC'])for(let i=1;i<=6;i++){const id=(team==='BAR'?'b':'l')+i;c.S.players[id]={id,name:id,team,pos:i===1?'POR':'JUG',rating:70+i,energy:100}}
 vm.createContext(c);vm.runInContext(preview,c);return {c,nodes,buttons,events};
}
test('preview shows both starting fives, reserves and ratings without starting the match',()=>{
 const {c,nodes,buttons}=previewSetup();assert.equal(c.matchPreviewOpen(),true);const h=nodes[0].innerHTML;for(const n of ['Our club','Opponent','b1','b6','l1','l6','Cinc inicial','Banqueta'])assert.ok(h.includes(n));assert.equal(c.calls.play,0);buttons['[data-preview-close]'].onclick();assert.equal(c.calls.play,0);assert.equal(c.S.round,0);
 buttons['[data-preview-start]'].onclick();assert.equal(c.calls.play,1);assert.equal(c.calls.run,1);
});
test('edit button opens our lineup; away and Catalan matches resolve the correct opponent',()=>{
 const {c,buttons}=previewSetup();c.cup={k:'LCAT'};assert.equal(c.matchPreviewNext().h,'LIC');c.matchPreviewOpen();buttons['[data-preview-edit]'].onclick();assert.equal(c.view,'alineacio');assert.equal(c.calls.play,0);
 c.catBatch=()=>[{h:'OTHER',a:'ELSE'}];assert.equal(c.matchPreviewNext(),undefined);assert.equal(c.matchPreviewOpen(),false);
});
