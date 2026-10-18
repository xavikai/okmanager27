import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const source=fs.readFileSync(new URL('../arcade.js',import.meta.url),'utf8');

// Smoke-test the complete script, DOM listeners and HUD with a fake GPU.
// This catches startup/renderer JavaScript errors, but is not a visual WebGL test.
function fakeObject() {
  const props={};
  let proxy;
  proxy=new Proxy(function(){},{
    get(_target,key){
      if(key===Symbol.toPrimitive)return ()=>0;
      if(key===Symbol.iterator)return function*(){};
      if(key==='measureText')return text=>({width:String(text).length*7});
      if(key==='getBoundingClientRect')return ()=>({width:390,height:600,left:0,top:0});
      if(key==='x'||key==='y'||key==='z')return props[key]||0;
      return props[key] ??= fakeObject();
    },
    set(_target,key,value){props[key]=value;return true;},
    apply(){return proxy;},construct(){return fakeObject();}
  });
  return proxy;
}

test('full arcade startup, rendering, passing, cards, pause and reset do not throw',()=>{
  const elements=new Map(),windowEvents=new Map();let nextFrame;
  function element(tag='div') {
    const value=fakeObject();
    value.children=[];value.value='';value.open=false;
    value.appendChild=child=>{
      value.children.push(child);
      if(tag==='select' && value.children.length===1)value.value=child.value;
    };
    value.replaceChildren=()=>{value.children=[];if(tag==='select')value.value='';};
    value.showModal=()=>{value.open=true;};value.close=()=>{value.open=false;};
    return value;
  }
  const document={
    getElementById(id){
      if(!elements.has(id)){
        const item=element(['benchOut','benchIn','matchDuration'].includes(id)?'select':'div'),events=new Map();
        item.addEventListener=(name,handler)=>events.set(name,handler);
        item.events=events;
        elements.set(id,item);
      }
      return elements.get(id);
    },
    createElement:tag=>element(tag),querySelectorAll:()=>[],addEventListener:()=>{}
  };
  const window={innerWidth:390,innerHeight:800,devicePixelRatio:1,
    addEventListener:(name,handler)=>windowEvents.set(name,handler)};
  const context=vm.createContext({document,window,THREE:fakeObject(),
    performance:{now:()=>10000},requestAnimationFrame:callback=>{nextFrame=callback;}});
  vm.runInContext(source,context);
  assert.ok(nextFrame,'animation starts');
  const frame=time=>nextFrame(time);
  frame(10016);frame(10034);
  const event={preventDefault(){},code:'Space',repeat:false};
  windowEvents.get('keydown')(event);
  frame(10051);
  elements.get('btnBench').events.get('click')();
  assert.equal(elements.get('benchDialog').open,true);
  assert.equal(elements.get('benchRoster').children.length,10);
  assert.equal(elements.get('benchOut').children.length,5);
  assert.equal(elements.get('benchIn').value,'home-30');
  elements.get('btnApplySub').events.get('click')();
  assert.match(elements.get('benchRoster').children[0].textContent,/Banqueta/);
  assert.match(elements.get('benchRoster').children[5].textContent,/En pista/);
  assert.match(elements.get('benchSummary').textContent,/Canvis: 1/);
  elements.get('btnCloseBench').events.get('click')();
  assert.equal(elements.get('benchDialog').open,false);
  assert.equal(elements.get('btnPause').textContent,'⏸ Pausa');
  elements.get('btnBlueCard').events.get('click')();
  for(let i=0;i<150;i++)frame(10051+i*1000/60);
  elements.get('btnPause').events.get('click')();frame(12600);
  elements.get('btnReset').events.get('click')();frame(12616);
  assert.equal(elements.get('hudCanvas').width,390);
  assert.equal(elements.get('hudCanvas').height,600);
});

test('website build includes the playable arcade page and engine',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'hm27-arcade-build-'));
  try {
    const build=fs.readFileSync(new URL('../scripts/build-site.cjs',import.meta.url),'utf8');
    const files=vm.runInNewContext(build.match(/const files=(\[[^;]+\]);/)[1]);
    fs.mkdirSync(path.join(root,'scripts'));
    fs.writeFileSync(path.join(root,'scripts/build-site.cjs'),build);
    for(const file of files)fs.writeFileSync(path.join(root,file),file==='index.html'?'<script src="cloud-manager.js"></script>':'fixture');
    for(const file of ['arcade.html','arcade.js'])fs.copyFileSync(new URL('../'+file,import.meta.url),path.join(root,file));
    execFileSync(process.execPath,[path.join(root,'scripts/build-site.cjs')]);
    for(const file of ['arcade.html','arcade.js'])assert.equal(fs.readFileSync(path.join(root,'dist',file),'utf8'),fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'));
  } finally {
    if(path.dirname(path.resolve(root))!==path.resolve(os.tmpdir()) || !path.basename(root).startsWith('hm27-arcade-build-'))throw Error('Unexpected temporary build directory');
    fs.rmSync(root,{recursive:true,force:true});
  }
});
