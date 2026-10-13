import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const between=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const feature=between('const CAT_CLUBS=','function start(data){');
const arrays=n=>vm.runInNewContext(html.match(new RegExp('const '+n+'=(\\[[\\s\\S]*?\\]);'))[1],{_tx:x=>x});
function setup(user='BAR',round=0){
 const teams=arrays('TEAMS0').concat(arrays('TEAMS_PLATA'),arrays('TEAMS_FEM'));
 const S={user,round,season:2026,teams:Object.fromEntries(teams.map(t=>[t.id,{...t,budget:20,lineup:[],tactic:{}}])),players:{},ledger:[],comp:{s:2026,C:{}},fixtures:[[{h:'BAR',a:'LIC',res:null}]],club:{oneoff:0}};
 const c={S,ui:{},view:'inici',COMPS:{},DIVS:{},calls:{league:0,finish:0,award:0,save:0,pen:0},W:s=>s,esc:s=>s,clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),R:()=>.1,cRating:()=>75,divOf:id=>teams.find(t=>t.id===id)?.div||'OK',teamOvr:id=>teams.find(t=>t.id===id)?.rep||1,squad:()=>[],autoFix:()=>{},aiTactic:()=>{},tac:id=>c.S.teams[id].tactic,pushNews:()=>{},cScorers:()=>'',money:String,cName:id=>c.S.teams[id].name,newChallenge:()=>{},compAward(){c.calls.award++},save(){c.calls.save++},compInit(){c.S.comp={s:c.S.season,C:{}}},migrate:st=>st,playRound(){c.calls.league++;c.ui.match={m:{h:user,a:'LIC'},round:1}},finishRound(){c.calls.finish++},afterMatch:()=>{},liveSeg:()=>{},render:()=>{},VIEWS:{inici:()=> 'League home',partit:()=>'<h2>Jornada 1</h2>'},document:{querySelectorAll:()=>[]},arenaHero:m=>m.h+' vs '+m.a,stName:s=>s,chargeAwayTravel(m){c.S.teams[m.a].budget-=.1},cMatch:(h,a)=>({gh:h===user?5:1,ga:a===user?5:0,ev:[]})};
 vm.createContext(c);vm.runInContext(between('function koWin(','function cScorers(')+between('function cLog(','function stName(')+between('function grpTable(','const COMP_SCHED')+feature,c);return c;
}
function playStep(c){c.playRound();if(c.view==='partit'){const m=c.ui.match.m;m.res=c.cMatch(m.h,m.a);m.res.lh=[];m.res.la=[];delete m.live;c.finishRound(m);c.view='inici'}}
test('eligibility, divisions and official main groups; other clubs start their league normally',()=>{
 for(const [id,k] of [['BAR','LCAT'],['PCPT','LCPL'],['FPAL','LCFEM'],['ALC','LCAT']]){
  const c=setup(id);c.catEnsure();assert.equal(c.catCurrent().k,k);assert.ok(c.catCurrent().teams.includes(id));assert.equal(c.S.round,0);
  if(k==='LCAT'){assert.equal(c.catCurrent().groups.B.join(','),'BAR,VOL,LLO,ALC');assert.equal(c.catCurrent().teams.length,12)}
  if(k==='LCPL'){assert.equal(c.catCurrent().teams.length,20);assert.ok(c.catCurrent().teams.every(t=>c.catKind(t)==='LCPL'))}
 }
 const c=setup('LIC');c.playRound();assert.equal(c.catCurrent(),null);assert.equal(c.calls.league,1);
});
test('round robin has exactly one meeting per pair, fair byes and no double booking',()=>{
 const c=setup();for(const n of [3,4,5]){const ids=Array.from({length:n},(_,i)=>String(i+1)),rounds=c.catRoundRobin(ids),pairs=rounds.flat();assert.equal(pairs.length,n*(n-1)/2);assert.equal(new Set(pairs.map(p=>p.slice().sort().join('-'))).size,pairs.length);for(const r of rounds)assert.equal(new Set(r.flat()).size,r.flat().length)}
});
test('complete group phase, live semifinals and final; league fixtures and player stats remain unchanged',()=>{
 const c=setup();c.catEnsure();const fx=JSON.stringify(c.S.fixtures);let steps=0;
 while(c.catCurrent()&&steps++<10)playStep(c);
 assert.equal(steps,5);assert.equal(c.S.comp.C.LCAT.st,'done');assert.equal(c.S.comp.C.LCAT.champ,'BAR');assert.equal(c.calls.award,1);assert.equal(c.calls.finish,0);assert.equal(c.S.round,0);assert.equal(JSON.stringify(c.S.fixtures),fx);assert.deepEqual(c.S.players,{});
 c.playRound();assert.equal(c.calls.league,1);assert.equal(c.ui.match.cat,undefined);
});
test('reloading mid-preseason preserves results and progress; completed cups do not restart',()=>{
 const c=setup('PCPT');c.catEnsure();playStep(c);const state=JSON.parse(JSON.stringify(c.S)),step=state.comp.C.LCPL.step;
 c.S=c.migrate(state);c.catEnsure();assert.equal(c.S.comp.C.LCPL.step,step);
 let count=0;while(c.catCurrent()&&count++<10)playStep(c);assert.equal(c.S.comp.C.LCPL.st,'done');const after=JSON.stringify(c.S.comp);c.catEnsure();assert.equal(JSON.stringify(c.S.comp),after);
});
test('ongoing careers gain the preseason next season without resetting their current competitions',()=>{
 const c=setup('BAR',4);c.S.comp.C.existing={marker:42};c.migrate(c.S);assert.equal(c.S.comp.C.existing.marker,42);assert.equal(c.S.comp.C.LCAT,undefined);
 c.S.season++;c.S.round=0;c.compInit();assert.equal(c.catCurrent().k,'LCAT');
});
test('group draws stand; knockout draws use penalties and cannot award twice',()=>{
 const c=setup();c.catEnsure();c.cMatch=()=>({gh:0,ga:0,ev:[]});c.koWin=(h,a)=>{c.calls.pen++;return {w:h,pen:true}};
 for(let i=0;i<3;i++)playStep(c);assert.equal(c.calls.pen,0);assert.ok(c.S.comp.C.LCAT.res.every(r=>r.gh===r.ga&&!r.x));
 while(c.catCurrent())playStep(c);assert.equal(c.calls.pen,3);assert.equal(c.calls.award,1);
 const m=c.ui.match.m;c.finishRound(m);assert.equal(c.calls.award,1);
});

test('women complete the same preseason cycle and progress survives a language switch',()=>{
 const c=setup('FPAL');c.catEnsure();playStep(c);const cup=c.S.comp.C.LCFEM;
 const group=Object.keys(cup.groups).find(g=>cup.groups[g].includes('FPAL'));
 const before=JSON.stringify(c.grpTable(cup,group));c.W=(ca,es)=>es||ca;assert.equal(JSON.stringify(c.grpTable(cup,group)),before);
 let n=0;while(c.catCurrent()&&n++<10)playStep(c);assert.equal(cup.st,'done');assert.equal(c.S.round,0);assert.equal(c.calls.award,1);
});
test('preseason trips use real travel accounting; duplicate finish does not charge again',()=>{
 const c=setup();vm.runInContext(readFileSync(new URL('../travel-costs.js',import.meta.url),'utf8')+between('function chargeAwayTravel(','function travelForecast('),c);c.catEnsure();
 playStep(c);assert.equal(c.S.ledger[0].tickets,.125);playStep(c);assert.ok(c.S.ledger[0].travel>0);assert.equal(c.S.ledger[0].r,0);
 const budget=c.S.teams.BAR.budget,ledger=JSON.stringify(c.S.ledger);c.finishRound(c.ui.match.m);assert.equal(c.S.teams.BAR.budget,budget);assert.equal(JSON.stringify(c.S.ledger),ledger);
});
test('competition screen renders every group and labels its preseason calendar',()=>{
 const c=setup();Object.assign(c,{isFem:id=>c.divOf(id)==='FEM',cupSVG:()=>'',shield:()=>'',cTeam:id=>c.S.teams[id]});
 vm.runInContext(between('const COMP_SCHED=','function compAfterRound(')+between('function compsView(){','/* ---------- Roda de premsa:'),c);c.catEnsure();const screen=c.compsView();
 for(const g of ['A','B','C'])assert.ok(screen.includes('Grup '+g));assert.match(screen,/abans de la lliga/);assert.ok(!screen.includes('undefined'));
});
