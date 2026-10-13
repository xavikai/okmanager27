import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
function setup(){const c={S:{season:2026,players:{},vetUsed:[]},VETS:[['Jordi López','POR'],['Jordi López','DAV']],yNorm:s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()};vm.createContext(c);
vm.runInContext(html.slice(html.indexOf('function migrateJordiLopez('),html.indexOf('function migrate(st)')),c);
vm.runInContext(html.slice(html.indexOf('const vetIdentity='),html.indexOf('const vetsIn=')),c);return c;}
test('same-name keeper and skater remain separate in the veteran pool',()=>{const c=setup();assert.equal(c.vetPool().length,2);c.S.players.k={name:'Jordi López',pos:'POR'};assert.equal(c.vetPool().length,1);assert.equal(c.vetPool()[0][1],'DAV');c.S.players={};c.S.vetUsed=['jordi lopez|JUG|2026'];assert.equal(c.vetPool()[0][1],'POR');});
test('old saves preserve veteran signing and negotiation history without hiding the other Jordi',()=>{const c=setup();const s={players:{k:{name:'Jordi López Vergés',pos:'POR'},j:{name:'Jordi Lopez',pos:'JUG'}},vetUsed:['jordi lopez verges|2026','jordi lopez|2025'],repTalk:{'v|jordi lopez verges|2026|1':1,'v|jordi lopez|2026|2':1},retired:[]};c.migrateJordiLopez(s);assert.equal(s.players.k.name,'Jordi López');assert.equal(s.players.j.name,'Jordi López');assert.deepEqual(s.vetUsed,['jordi lopez|POR|2026','jordi lopez|JUG|2025']);assert.equal(s.repTalk['v|jordi lopez|POR|2026|1'],1);assert.equal(s.repTalk['v|jordi lopez|JUG|2026|2'],1);const before=JSON.stringify(s);c.migrateJordiLopez(s);assert.equal(JSON.stringify(s),before);});
