import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const source=readFileSync(new URL('../travel-costs.js',import.meta.url),'utf8');
function functionSource(name){return html.match(new RegExp('function '+name+'\\([^]*?\\n}'))[0]}
function setup(){
  const news=[],teams={BAR:{rep:5,budget:60,inc:104,name:'Barça'},REU:{rep:4,budget:22,inc:104,name:'Reus'},LIC:{rep:5,budget:50,inc:104,name:'Liceo'}};
  const c={S:{user:'BAR',round:0,teams,ledger:[],club:{}},R:()=>.5,divOf:()=> 'OK',salaryMass:()=>26,squad:()=>Array(12).fill({}),sponsorIncome:()=>.5,clubRound:()=>({tickets:0,bar:0,staff:0,inc:0,extra:0,att:0}),pushNews:s=>news.push(s),W:ca=>ca,money:n=>String(n),cName:id=>teams[id]?.name||id,cScorers:()=>'',COMPS:{WCL:{n:()=> 'Europa'}}};
  vm.createContext(c);vm.runInContext(source+'\n'+functionSource('chargeAwayTravel')+'\n'+functionSource('finances')+'\n'+functionSource('cLog'),c);return {c,news};
}
test('local, regional and long trips grow in cost; only long trips need a hotel',()=>{
  const {c}=setup(),local=c.travelEstimate('BAR','PBAR'),regional=c.travelEstimate('BAR','REU'),long=c.travelEstimate('BAR','LIC');
  assert.equal(local.km,0);assert.ok(local.total>0);assert.equal(local.hotel,0);assert.equal(regional.hotel,0);assert.ok(regional.total>local.total);assert.ok(long.total>regional.total);assert.equal(long.nights,1);assert.ok(long.hotel>0);assert.equal(long.flight,true);
  assert.equal(long.total,Math.round((long.transport+long.meals+long.hotel)*1000)/1000);
  assert.ok(c.travelEstimate('BAR','LIC',12,1).total<c.travelEstimate('BAR','LIC',12,5).total);
  assert.ok(Number.isFinite(c.travelEstimate('missing','BAR').total));
});
test('league away cost reduces budget and reconciles with the ledger; home team pays no trip',()=>{
  const {c,news}=setup();const m={h:'LIC',a:'BAR',res:{gh:0,ga:0}},trip=c.travelEstimate('BAR','LIC',12,5);
  c.finances([m]);assert.ok(Math.abs(c.S.teams.BAR.budget-(60+.5-1-trip.total))<1e-9);
  const l=c.S.ledger[0];assert.equal(l.travel,trip.total);assert.equal(l.travelTrips.length,1);assert.equal(news.length,1);assert.equal(m.travelPaid,true);
  const ledgerBalance=l.tickets+l.spons+l.bar-l.sal-l.staff-l.travel+l.extra;
  assert.ok(Math.abs(ledgerBalance-(c.S.teams.BAR.budget-60))<1e-9);
  const budget=c.S.teams.BAR.budget;c.chargeAwayTravel(m,1);assert.equal(c.S.teams.BAR.budget,budget);
  const home=setup().c;home.finances([{h:'BAR',a:'REU',res:{gh:0,ga:0}}]);assert.equal(home.S.ledger[0].travel,undefined);const away=home.travelEstimate('REU','BAR',12,4);assert.ok(Math.abs(home.S.teams.REU.budget-(22+2.2-1-away.total))<1e-9);
});
test('cup away trips accumulate in the same round; neutral rounds and duplicate logs do not charge',()=>{
  const {c}=setup();c.S.round=1;c.finances([{h:'REU',a:'BAR',res:{gh:0,ga:0}}]);c.S.round=2;
  const leagueCost=c.S.ledger[0].travel,cup={k:'WCL',res:[]},r={gh:1,ga:1,ev:[]};
  const budget=c.S.teams.BAR.budget;c.cLog(cup,'Group J1','LIC','BAR',r,'');assert.ok(c.S.teams.BAR.budget<budget);assert.ok(c.S.ledger[0].travel>leagueCost);assert.equal(c.S.ledger[0].travelTrips.length,2);
  const after=c.S.teams.BAR.budget;c.cLog(cup,'Group J1','LIC','BAR',r,'');assert.equal(c.S.teams.BAR.budget,after);c.cLog(cup,'Final','LIC','BAR',r,'',true);assert.equal(c.S.teams.BAR.budget,after);
  c.chargeAwayTravel({h:'LIC',a:'BAR'},2);assert.equal(c.S.teams.BAR.budget,after);
});
test('game inline scripts still parse and travel assets are shipped offline',()=>{
  for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
  assert.ok(html.includes('src="travel-costs.js"'));assert.ok(html.includes('-(l.travel||0)'));
  assert.ok(readFileSync(new URL('../sw.js',import.meta.url),'utf8').includes('"travel-costs.js"'));
  assert.ok(readFileSync(new URL('../scripts/build-site.cjs',import.meta.url),'utf8').includes("'travel-costs.js'"));
});

test('finance view renders travel and hotel costs and remains compatible with old ledgers',()=>{
  const {c}=setup();c._tx=x=>x;c.esc=x=>x;c.FX=()=>[];c.myDiv=()=> 'OK';
  const start=html.indexOf('finances(){'),end=html.indexOf('\n},\nopcions(){',start);
  vm.runInContext(functionSource('travelForecast')+'\nfunction financesView()'+html.slice(start+'finances()'.length,end)+'\n}',c);
  assert.match(c.financesView(),/colspan="9"/);
  c.finances([{h:'LIC',a:'BAR',res:{gh:0,ga:0}}]);const rendered=c.financesView();
  assert.match(rendered,/Viatges/);assert.match(rendered,/Amb allotjament/);assert.ok(!rendered.includes('NaN'));
  delete c.S.ledger[0].travel;delete c.S.ledger[0].travelTrips;assert.ok(!c.financesView().includes('NaN'));
  c.FX=()=>[[{h:'LIC',a:'BAR',res:null}]];assert.match(c.travelForecast(),/Proper desplaçament/);assert.match(c.travelForecast(),/una nit/);
});
