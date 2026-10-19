import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const between=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const array=n=>vm.runInNewContext(html.match(new RegExp('(?:const|let|var) '+n+'\\s*=\\s*(\\[[\\s\\S]*?\\]);'))[1],{_tx:x=>x});
function setup(){
 const c={S:null,saves:0,clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),hash:()=>1,rng:()=>()=>.5,ri:(a,b)=>Math.round((a+b)/2),salaryOf:()=>1,PLATA_IDS:new Set(['PCPT']),INT_IDS:new Set(),FEM_IDS:new Set(),ALLTEAMS:array('TEAMS0').concat(array('TEAMS_PLATA'),array('TEAMS_FEM')),TEAMS_INT:array('TEAMS_INT'),YOUTH:array('YOUTH'),YOUTH0:array('YOUTH'),save(){c.saves++},avail:p=>!p.inj,squad:tid=>Object.values(c.S.players).filter(p=>p.team===tid)};
 vm.createContext(c);vm.runInContext(between('const ROSTER_ROLES=','/* Sous (estimats)')+between('function rosterBaseFix(){','rosterBaseFix();\nconst _renderRosterRoles')+between('function autoLineup(tid){','function lineupOf(tid){'),c);return c;
}
test('Tordera and other verified keepers have the same roles in senior and youth data',()=>{
 const c=setup();c.rosterBaseFix();
 for(const [id,name,pos] of [['PCPT','Marc Vila','JUG'],['PCPT','Xavier Gubau','POR'],['PCPT','Roger Haro','POR'],['PPAL','Roger Sayeras','POR'],['PMAN','Carlos Paneque','POR'],['PMAN','Iu López','POR']]){
  const a=c.ALLTEAMS.find(t=>t.id===id).p.find(p=>p[0]===name);assert.equal(a[1],pos);
  assert.equal(c.makePlayer([name,pos==='POR'?'DEF':'POR',null,70,'ESP'],id,'p1').pos,pos);
  for(const y of c.YOUTH.filter(y=>y[2]===id&&c.rosterName(y[1])===c.rosterName(name)))assert.equal(y[6],pos);
 }
});
test('old saves repair both kinds of wrong role, ratings, transfers and invalid lineups once',()=>{
 const c=setup(),a={pat:72,tec:72,xut:72,def:72,fis:72,ref:72,col:72};
 const mk=(id,name,pos,team='PCPT')=>({id,name,pos,team,a:{...a},age:22,nat:'ESP',energy:87,inj:0,goals:4,apps:9,salary:3,contract:2030});
 const ps=[mk('m','Marc Vila','POR'),mk('x','Xavier Gubau','JUG'),mk('r','Roger Haro','JUG','OTHER'),...Array.from({length:4},(_,i)=>mk('p'+i,'Other '+i,'JUG'))];
 c.S={players:Object.fromEntries(ps.map(p=>[p.id,p])),teams:{PCPT:{lineup:['m','x','p0','p1','p2']},OTHER:{lineup:['r',null,null,null,null]}}};
 c.rosterRoleFix();assert.equal(ps[0].pos,'JUG');assert.equal(ps[1].pos,'POR');assert.equal(ps[2].pos,'POR');assert.equal(ps[2].team,'OTHER');
 for(const p of ps.slice(0,3)){assert.equal(c.ovr(p),72);assert.equal(p.contract,2030);assert.equal(p.salary,3);assert.equal(p.apps,9);assert.equal(p.goals,4);assert.equal(p.energy,87)}
 assert.equal(ps[0].a.ref,20);assert.equal(c.S.teams.PCPT.lineup[0],'x');for(const id of c.S.teams.PCPT.lineup.slice(1))if(id)assert.equal(c.S.players[id].pos,'JUG');
 ps[1].a.ref=90;const snapshot=JSON.stringify(c.S);c.rosterRoleFix();assert.equal(JSON.stringify(c.S),snapshot);assert.equal(c.saves,1);assert.equal(ps[3].rosterRoleV,undefined);
});
test('base correction overrides cached wrong positions without changing unrelated players',()=>{
 const c=setup(),t=c.ALLTEAMS.find(t=>t.id==='PCPT');t.p.find(p=>p[0]==='Roger Haro')[1]='JUG';const other=t.p.find(p=>p[0]==='Pau Carbonell');c.rosterBaseFix();assert.equal(t.p.find(p=>p[0]==='Roger Haro')[1],'POR');assert.equal(other[1],'POR');
});
test('federation stats never invent a field role for an unknown new player',()=>{
 const c=setup();Object.assign(c,{fedTeamMap:()=>({'rfep|1':'PCPT'}),fedNameKey:()=>({first:'NEW',sur:'KEEPER',nice:'New Keeper'}),fedMatch:()=>false,ARXIU:[]});
 vm.runInContext(between('function fedCompute(data){','function fedSaved(){'),c);
 const f=c.fedCompute({teams:[],rows:[['rfep',1,1,'Keeper, New',2,0,0]]});assert.equal(f.unverifiedRoles.length,1);assert.equal(f.unverifiedRoles[0][1],'New Keeper');assert.equal(f.teams.PCPT,undefined);
});
test('all inline scripts parse after the migration and importer changes',()=>{
 for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
});

test('migration preserves ratings at attribute limits in either direction',()=>{
 for(const rating of [20,50,85,99])for(const [name,pos] of [['Marc Vila','POR'],['Roger Haro','JUG']]){
  const c=setup(),p={id:'p',name,pos,team:'PCPT',age:22,nat:'ESP',a:Object.fromEntries(['pat','tec','xut','def','fis','ref','col'].map(k=>[k,rating]))};
  c.S={players:{p},teams:{PCPT:{lineup:[]}}};c.rosterRoleFix();assert.equal(c.ovr(p),rating);
 }
});
test('old cached update cannot propose a verified keeper as a field player',()=>{
 const c=setup();c.yNorm=c.rosterName;c.UPD={updated:'old',teams:{PCPT:{pos:{'Roger Haro':'JUG'}}}};
 c.S={players:{p:{id:'p',name:'Roger Haro',team:'PCPT',pos:'POR'}},teams:{PCPT:{}}};
 vm.runInContext(between('function updDiff(){','function updApply(){'),c);assert.equal(c.updDiff().ps.length,0);
});
