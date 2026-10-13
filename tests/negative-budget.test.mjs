import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('function budgetAmount('),html.indexOf('/* Fi alertes de pressupost */',html.indexOf('function budgetAmount(')));
function setup(budget=-5){
 const news=[],toasts=[],c={S:{user:'BAR',season:2026,finished:false,teams:{BAR:{budget}},club:{bar:{staff:'pro'}}},view:'inici',money:n=>n+' k€',W:s=>s,esc:s=>s,squad:()=>[{name:'High Salary',salary:10},{name:'Lower Salary',salary:2}],pushNews:m=>news.push(m),toast:m=>toasts.push(m),saves:0,save(){c.saves++},render:()=>{},endSeason(){c.S.finished=true;c.S.teams.BAR.budget+=2}};
 vm.createContext(c);vm.runInContext(source,c);return {c,news,toasts};
}
test('negative budgets are red and the plan offers available actions with real cost tradeoffs',()=>{
 const {c}=setup();assert.match(c.budgetAmount(-5),/color:var\(--bad\)/);assert.ok(!c.budgetAmount(0).includes('bad'));assert.ok(!c.budgetAmount(5).includes('bad'));
 const panel=c.budgetWarningPanel();assert.match(panel,/5 k€/);assert.match(panel,/High Salary/);assert.match(panel,/patrocinador/);assert.match(panel,/indemnització/);assert.match(panel,/voluntaris/);for(const v of ['finances','plantilla','club','cos'])assert.ok(panel.includes('data-v="'+v+'"'));
 c.S.club.sponsor={};assert.match(c.budgetWarningPanel(),/contracte del patrocinador/);
});
test('normal play warns once per deficit episode; recovery removes the panel',()=>{
 const {c,news}=setup();c.render();c.render();assert.equal(news.length,1);assert.equal(c.saves,1);assert.equal(c.S.teams.BAR.budget,-5);
 c.S.teams.BAR.budget=0;c.render();assert.equal(c.budgetWarningPanel(),'');c.S.teams.BAR.budget=-1;c.render();assert.equal(news.length,2);
});
test('season close is evaluated after prizes, once, and does not forgive the deficit',()=>{
 const {c,news,toasts}=setup();c.endSeason();assert.equal(c.S.teams.BAR.budget,-3);assert.equal(toasts.length,1);assert.match(toasts[0],/-3 k€/);c.render();c.render();assert.equal(toasts.length,1);assert.equal(news.length,2);
 c.S.season++;c.S.finished=false;c.render();assert.equal(c.S.teams.BAR.budget,-3);assert.equal(c.S.budgetWarning.season,2027);assert.match(c.budgetWarningPanel(),/saldo es conserva/);
 const healthy=setup(-1);healthy.c.endSeason();assert.equal(healthy.c.S.teams.BAR.budget,1);assert.equal(healthy.toasts.length,0);assert.equal(healthy.c.budgetWarningPanel(),'');
});
test('restoring a finished negative career shows the close warning; restored acknowledgments do not spam',()=>{
 const {c,toasts}=setup();c.S.finished=true;c.render();const st=JSON.parse(JSON.stringify(c.S));c.S=st;c.render();assert.equal(toasts.length,1);assert.match(c.budgetWarningPanel(),/Temporada acabada/);
 c.S.user='OTHER';c.S.teams.OTHER={budget:-2};c.render();assert.equal(c.S.budgetWarning.team,'OTHER');assert.equal(toasts.length,2);
});
