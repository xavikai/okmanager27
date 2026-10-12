import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../exit-save.js',import.meta.url),'utf8');
function setup(){
  const events=new Map(),buttons=new Map(),elements=[];let saves=0;
  const c={S:{slot:'test'},CLOUD:{mode:'cf',uid:'alice',idx:{slots:{}},msg:''},cloudRunning:false,cloudPending:new Map(),ticker:null,ui:{},view:'inici',startStep:'menu',W:a=>a,save(){saves++},cloudFlush:async()=>{},render(){},toast(){},window:{addEventListener:(name,fn)=>events.set(name,fn),scrollTo(){}},document:{querySelector:()=>null,body:{appendChild(){}},addEventListener:(name,fn)=>events.set(name,fn),createElement(){
    const el={style:{},setAttribute(){},innerHTML:'',showModal(){el.open=true},remove(){el.open=false},addEventListener(name,fn){el[name]=fn},querySelector(selector){if(!buttons.has(selector))buttons.set(selector,{hidden:true,disabled:false,focus(){}});return buttons.get(selector)},querySelectorAll(){return [...buttons.values()]}};elements.push(el);return el;
  }},Date,setTimeout,clearInterval,Promise};vm.createContext(c);vm.runInContext(source,c);
  const click=()=>events.get('click')({target:{closest:()=>true},preventDefault(){},stopImmediatePropagation(){}});
  return {c,buttons,elements,events,click,saves:()=>saves};
}
test('cancel keeps the game; saving exits only after confirmation',async()=>{
  const x=setup();x.click();assert.match(x.elements[0].innerHTML,/Desar partida abans de sortir/);x.buttons.get('[data-exit-cancel]').onclick();assert.ok(x.c.S);assert.equal(x.saves(),0);
  x.click();await x.buttons.get('[data-exit-save]').onclick();assert.equal(x.c.S,null);assert.equal(x.saves(),1);
});
test('cloud failure keeps the game and offers explicit local-only exit',async()=>{
  const x=setup();x.c.cloudFlush=async()=>{x.c.CLOUD.msg='offline'};x.click();await x.buttons.get('[data-exit-save]').onclick();assert.ok(x.c.S);assert.equal(x.buttons.get('[data-exit-local]').hidden,false);assert.match(x.buttons.get('[data-exit-message]').textContent,/no s’ha confirmat/);x.buttons.get('[data-exit-local]').onclick();assert.equal(x.c.S,null);
});
test('live match exit remains blocked by the game; tab warning applies only to pending saves',()=>{
  const x=setup();x.c.ui.match={m:{live:true}};x.c.view='partit';x.click();assert.equal(x.elements.length,0);
  let warnings=0;const event={preventDefault(){warnings++}};x.events.get('beforeunload')(event);assert.equal(warnings,0);x.c.cloudPending.set('test',{});x.events.get('beforeunload')(event);assert.equal(warnings,1);
});
