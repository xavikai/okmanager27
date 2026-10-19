import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
test('installation is prominent before a native prompt and has a manual installation fallback',()=>{
 const c={W:a=>a,window:{matchMedia:()=>({matches:false}),addEventListener(){}},navigator:{},document:{addEventListener(){}}};vm.createContext(c);vm.runInContext(readFileSync(new URL('../install.js',import.meta.url),'utf8'),c);
 assert.match(c.installCallout(),/data-install-game/);assert.match(c.installCallout(),/Instal·la l’aplicació/);assert.match(c.installPanel(),/Safari/);
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.ok(html.indexOf('installCallout():')<html.indexOf('<div class="homemodes">'));
 c.window.matchMedia=()=>({matches:true});assert.equal(c.installCallout(),'');
});
