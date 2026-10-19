/* Presència efímera. La llista de comptes només la retorna el servidor al creador. */
(()=>{
  if(location.hostname!=='hoquei-manager27.pages.dev')return;
  const visitor=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
  let running=false,lastPost=0;
  async function heartbeat(active=document.visibilityState==='visible'){
    if(navigator.onLine===false)return;
    if(active&&Date.now()-lastPost<15000)return;
    lastPost=active?Date.now():0;
    try{await fetch('/api/presence',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({visitor,active})})}catch{}
  }
  async function refresh(){
    const panel=document.querySelector('[data-creator-presence]');
    if(!panel||!CLOUD.creator||running||document.visibilityState!=='visible')return;
    running=true;const user=CLOUD.uid;
    try{
      const response=await fetch('/api/presence',{credentials:'same-origin',cache:'no-store'});
      if(!response.ok)throw Error('Unavailable');const data=await response.json();
      if(user!==CLOUD.uid||!CLOUD.creator||!panel.isConnected)return;
      panel.innerHTML=`<h2>${W('Ara a l’aplicació','Ahora en la aplicación')}</h2><p>${data.signedIn} ${W('comptes connectats','cuentas conectadas')} · ${data.anonymous} ${W('visites sense sessió','visitas sin sesión')}</p><p class="muted">${W('Activitat dels darrers 5 minuts. Una persona pot tenir més d’una visita oberta. Només tu pots veure aquest panell.','Actividad de los últimos 5 minutos. Una persona puede tener más de una visita abierta. Solo tú puedes ver este panel.')}</p>${data.users.length?`<ul>${data.users.map(u=>`<li>${esc(u.name)}</li>`).join('')}</ul>`:''}<button class="btn small" data-presence-refresh>${W('Actualitza','Actualiza')}</button>`;
    }catch{if(user===CLOUD.uid&&CLOUD.creator&&panel.isConnected)panel.textContent=W('No s’ha pogut llegir la presència. Torna-ho a provar.','No se ha podido leer la presencia. Vuelve a intentarlo.')}
    finally{running=false}
  }
  const previousMenu=menuAccount;
  menuAccount=function(){return previousMenu()+(CLOUD.creator?`<section class="bevel panel" data-creator-presence aria-live="polite"><h2>${W('Ara a l’aplicació','Ahora en la aplicación')}</h2><p>${W('Carregant persones connectades…','Cargando personas conectadas…')}</p></section>`:'')};
  const previousRender=render;
  render=function(){const result=previousRender.apply(this,arguments);refresh();return result};
  document.addEventListener('click',event=>{if(event.target.closest('[data-presence-refresh]'))refresh()});
  document.addEventListener('visibilitychange',()=>{heartbeat();if(document.visibilityState==='visible')refresh()});
  window.addEventListener('pagehide',()=>heartbeat(false));
  window.addEventListener('online',()=>{lastPost=0;heartbeat();refresh()});
  window.addEventListener('hm27-account-change',()=>{lastPost=0;heartbeat()});
  setInterval(()=>{heartbeat();refresh()},30000);
  heartbeat();if(!S)render();
})();
