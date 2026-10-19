/* Partides privades a Cloudflare D1. La identitat la valida el servidor. */
(() => {
  let clientId=null,identityReady=null,loginDialog=null,localVersions={};
  const previousInit=cloudInit,previousIndex=cloudIndex,previousLogin=cloudLogin;
  const previousFlush=cloudFlush,previousPull=cloudPull,previousDelete=cloudDelete;
  const previousBlock=cloudBlock;
  const previousQueue=cloudQueue,previousSchedule=cloudSchedule;
  let finishPending=false,lastFinish=0,indexRequest=null;
  const isCloudflare=location.hostname==='hoquei-manager27.pages.dev';
  async function api(path,method='GET',body,user=CLOUD.uid) {
    const serialized=body?JSON.stringify(body):null;
    const keepalive=method==='PUT'&&path.startsWith('saves/')&&new TextEncoder().encode(serialized).byteLength<=60000;
    const response=await fetch('/api/'+path,{method,credentials:'same-origin',cache:'no-store',keepalive,headers:{...(body?{'Content-Type':'application/json'}:{}),...(user?{'X-HM27-User':user}:{})},...(body?{body:serialized}:{})});
    if(!response.ok){const error=new Error('Cloud request failed');error.status=response.status;throw error}
    return response.json();
  }
  function setUser(user) {
    clearTimeout(cloudTimer);cloudTimer=null;cloudPending.clear();cloudNext=0;
    CLOUD.uid=user?.id||null;CLOUD.name=user?.name||'';CLOUD.creator=user?.creator===true;CLOUD.idx=null;CLOUD.msg='';
    window.dispatchEvent?.(new Event('hm27-account-change'));
    if(typeof cloudLocalLinks!=='undefined'){cloudLocalLinks.clear();cloudConflicts.clear()}
    localVersions={};if(CLOUD.uid){try{localVersions=JSON.parse(localStorage.getItem('hm27-cloud-versions-'+CLOUD.uid)||'{}')}catch{}}
  }
  function rememberVersion(slot,version) {
    if(version)localVersions[slot]=version;else delete localVersions[slot];
    try{localStorage.setItem('hm27-cloud-versions-'+CLOUD.uid,JSON.stringify(localVersions))}catch{}
  }
  if(typeof cloudSyncHooks!=='undefined'){cloudSyncHooks.version=slot=>localVersions[slot]||null;cloudSyncHooks.remember=rememberVersion}
  const remoteId=(id,st)=>typeof cloudRemoteSlot==='function'?cloudRemoteSlot(id,st):id;
  function syncText(){
    if(!CLOUD.uid)return W('Desada al dispositiu · inicia sessió per activar el núvol','Guardada en el dispositivo · inicia sesión para activar la nube');
    if(typeof cloudConflictMessage==='function'&&cloudConflictMessage())return cloudConflictMessage();
    if(CLOUD.msg)return CLOUD.msg;
    if(!CLOUD.idx)return W('Connectant amb el núvol…','Conectando con la nube…');
    if(CLOUD.busy)return W('Desant al núvol…','Guardando en la nube…');
    if(cloudPending.size)return navigator.onLine===false?W('Sense connexió · canvis desats al dispositiu, núvol pendent','Sin conexión · cambios guardados en el dispositivo, nube pendiente'):W('Canvis desats al dispositiu · sincronització pendent','Cambios guardados en el dispositivo · sincronización pendiente');
    if(slotsList().some(meta=>!CLOUD.idx.slots[remoteId(meta.id)]||meta.upd>CLOUD.idx.slots[remoteId(meta.id)].upd))return W('Hi ha partides locals pendents · obre-les per sincronitzar-les','Hay partidas locales pendientes · ábrelas para sincronizarlas');
    return W('✓ Còpies del núvol al dia','✓ Copias de la nube al día');
  }
  function syncStatus(){
    if(!isCloudflare||!document.createElement)return;
    let badge=document.querySelector('[data-cloud-status]');
    if(!badge){badge=document.createElement('div');badge.dataset.cloudStatus='';badge.setAttribute('role','status');badge.setAttribute('aria-live','polite');badge.style.cssText='position:fixed;left:12px;bottom:calc(12px + env(safe-area-inset-bottom));max-width:calc(100vw - 90px);padding:7px 10px;border-radius:8px;background:#fff;color:#17243b;box-shadow:0 2px 12px #0002;font:12px/1.3 system-ui;z-index:40;pointer-events:none';document.body.appendChild(badge)}
    badge.hidden=!S;const text=syncText();if(badge.textContent!==text)badge.textContent=text;
    const inline=document.querySelector('[data-cloud-menu-status]');if(inline)inline.textContent=text;
  }
  cloudSchedule=function(){
    if(CLOUD.mode!=='cf')return previousSchedule();
    if(cloudTimer||cloudRunning||!cloudPending.size)return;
    cloudTimer=setTimeout(()=>{cloudTimer=null;cloudFlush()},Math.max(5000,cloudNext-Date.now()));
  };
  cloudQueue=function(slot,j){
    if(CLOUD.mode!=='cf')return previousQueue(slot,j);
    if(!CLOUD.uid)return;
    cloudPending.set(slot,{slot,j,uid:CLOUD.uid,compression:gz(j).catch(()=>null)});
    cloudSchedule();syncStatus();
  };
  function googleReady() {
    if(identityReady)return identityReady;
    identityReady=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;
      script.onload=()=>{google.accounts.id.initialize({client_id:clientId,callback:async result=>{
        try{const data=await api('auth','POST',{credential:result.credential});setUser(data.user);loginDialog?.remove();loginDialog=null;await cloudIndex();toast(W('Sessió iniciada. Pots desar les partides al núvol.','Sesión iniciada. Puedes guardar las partidas en la nube.'))}
        catch{toast(W('No s’ha pogut iniciar sessió amb Google.','No se ha podido iniciar sesión con Google.'))}
      }});resolve()};
      script.onerror=()=>{identityReady=null;reject(Error('Google unavailable'))};document.head.appendChild(script);
    });return identityReady;
  }
  cloudInit=async function() {
    if(!isCloudflare)return previousInit();
    if(CLOUD.started)return;CLOUD.started=true;
    try{const config=await api('auth');clientId=config.clientId;CLOUD.mode=config.enabled?'cf':null;setUser(config.user);if(CLOUD.uid)await cloudIndex();else if(!S)render()}
    catch{CLOUD.mode=null;if(!S)render()}
  };
  async function refreshIndex() {
    if(CLOUD.mode!=='cf')return previousIndex();
    if(!CLOUD.uid)return;const user=CLOUD.uid;
    try{const index=await api('saves');if(user===CLOUD.uid){CLOUD.idx=index;CLOUD.msg='';
      // Després de reiniciar, reprèn només les còpies locals conegudes d’aquest compte.
      for(const meta of slotsList()){const state=await loadSlotAsync(meta.id);if(state?.cloudOrigin)continue;const remote=index.slots[meta.id];if(remote&&localVersions[meta.id]===remote.version&&meta.upd>remote.upd&&state&&user===CLOUD.uid)cloudQueue(meta.id,JSON.stringify(state))}
      if(typeof cloudReconcileLinked==='function')await cloudReconcileLinked(index,user);
      if(typeof cloudConflictMessage==='function')CLOUD.msg=cloudConflictMessage();
    }}
    catch(error){if(user===CLOUD.uid){CLOUD.idx=null;CLOUD.msg=W('No s’ha pogut llegir el núvol. Torna a iniciar sessió o comprova la connexió.','No se ha podido leer la nube. Vuelve a iniciar sesión o comprueba la conexión.');if(error.status===401)setUser(null)}}
    if(!S)render();if(CLOUD.idx)cloudSchedule();syncStatus();
  }
  cloudIndex=async function(){if(indexRequest)return indexRequest;const request=refreshIndex();indexRequest=request;try{return await request}finally{if(indexRequest===request)indexRequest=null}};
  cloudLogin=async function() {
    if(CLOUD.mode!=='cf')return previousLogin();
    try{
      await googleReady();loginDialog?.remove();loginDialog=document.createElement('dialog');
      loginDialog.innerHTML=`<p>${W('Inicia sessió per guardar les teves partides i continuar-les en altres dispositius.','Inicia sesión para guardar tus partidas y continuarlas en otros dispositivos.')}</p><div data-google-button></div><p><a href="privacitat.html" target="_blank" rel="noopener">${W('Com es guarden les teves dades','Cómo se guardan tus datos')}</a></p><p><button class="btn" data-google-close>${W('Tanca','Cerrar')}</button></p>`;
      document.body.appendChild(loginDialog);loginDialog.querySelector('[data-google-close]').onclick=()=>{loginDialog.remove();loginDialog=null};loginDialog.showModal();
      google.accounts.id.renderButton(loginDialog.querySelector('[data-google-button]'),{type:'standard',theme:'outline',size:'large',text:'signin_with'});
    }catch{toast(W('Google no està disponible. Comprova la connexió i torna-ho a provar.','Google no está disponible. Comprueba la conexión y vuelve a intentarlo.'))}
  };
  cloudFlush=async function(manual=false) {
    if(CLOUD.mode!=='cf')return previousFlush(manual);
    if(cloudRunning){if(manual)finishPending=true;return}
    if(!CLOUD.uid||!CLOUD.idx)return;
    if(!manual&&Date.now()<cloudNext){cloudSchedule();return}
    clearTimeout(cloudTimer);cloudTimer=null;
    const pending=Array.from(cloudPending.values());cloudPending.clear();if(!pending.length)return;
    const user=CLOUD.uid;cloudRunning=true;CLOUD.busy=true;cloudNext=Date.now()+30000;CLOUD.msg='';syncStatus();
    try{
      for(const item of pending){
        if(item.uid!==user||CLOUD.uid!==user)continue;
        const state=JSON.parse(item.j),origin=state.cloudOrigin;
        if(origin&&origin.user!==user){CLOUD.msg=W('Aquesta partida està vinculada a un altre compte. El progrés es conserva al dispositiu.','Esta partida está vinculada a otra cuenta. Se conserva el progreso en el dispositivo.');continue}
        const slot=remoteId(item.slot,state),metadata={...slotMetaOf(state,slot),id:slot},remote=CLOUD.idx.slots[slot];
        const base=origin?.version||localVersions[slot];
        if((origin&&!remote)||(remote&&(base!==remote.version||(!origin&&remote.upd>metadata.upd+5000)))){
          if(origin&&typeof cloudMarkConflict==='function')cloudMarkConflict(item.slot,state,slot);
          else CLOUD.msg=W('Hi ha una còpia del núvol que aquest dispositiu encara no ha carregat. Continua-la des del núvol abans de tornar a desar.','Hay una copia de la nube que este dispositivo todavía no ha cargado. Continúala desde la nube antes de volver a guardar.');continue;
        }
        try{
          const persisted=origin?{...state,slot}:state;delete persisted.cloudOrigin;const snapshot=JSON.stringify(persisted),fingerprint=origin&&typeof cloudFingerprint==='function'?await cloudFingerprint(state):null,compressed=await gz(snapshot);if(CLOUD.uid!==user)continue;
          const result=await api('saves/'+encodeURIComponent(slot),'PUT',{data:compressed||snapshot,z:!!compressed,metadata,version:remote?.version||null},user);
          if(CLOUD.uid===user){
            CLOUD.idx.slots[slot]={...metadata,version:result.version};rememberVersion(slot,result.version);
            if(origin&&typeof cloudAcknowledge==='function')await cloudAcknowledge(item.slot,slot,origin.version,result.version,metadata.upd,user,fingerprint);
            const queued=cloudPending.get(item.slot);
            if(queued&&origin){const next=JSON.parse(queued.j);if(next.cloudOrigin?.version===origin.version){next.cloudOrigin.version=result.version;next.cloudOrigin.syncedAt=metadata.upd;next.cloudOrigin.syncedHash=fingerprint;queued.j=JSON.stringify(next);queued.compression=null}}
          }
        }catch(error){
          if(CLOUD.uid!==user)continue;
          if(error.status===409){await cloudIndex();if(origin&&typeof cloudMarkConflict==='function')cloudMarkConflict(item.slot,state,slot);else CLOUD.msg=W('La partida ha canviat en un altre dispositiu o has arribat al límit de 10 partides al núvol. Revisa les còpies abans de tornar a desar.','La partida ha cambiado en otro dispositivo o has llegado al límite de 10 partidas en la nube. Revisa las copias antes de volver a guardar.');continue}
          if(!cloudPending.has(item.slot))cloudPending.set(item.slot,item);
          cloudNext=Date.now()+60000;CLOUD.msg=W('La còpia al núvol està pendent. La partida continua desada al dispositiu.','La copia en la nube está pendiente. La partida sigue guardada en el dispositivo.');
        }
      }
    }finally{cloudRunning=false;CLOUD.busy=false;const finish=finishPending;finishPending=false;cloudSchedule();if(!S)render();syncStatus();if(finish&&cloudPending.size&&Date.now()<cloudNext&&CLOUD.msg==='')cloudFlush(true)}
  };
  cloudPull=async function(slot) {
    if(CLOUD.mode!=='cf')return previousPull(slot);
    const user=CLOUD.uid,result=await api('saves/'+encodeURIComponent(slot));
    const state=JSON.parse(result.z?await gunz(result.data):result.data);
    if(CLOUD.uid!==user)throw Error('Session changed');
    CLOUD.idx.slots[slot]={...slotMetaOf(state,slot),version:result.version};rememberVersion(slot,result.version);return state;
  };
  cloudDelete=async function(slot) {
    if(CLOUD.mode!=='cf')return previousDelete(slot);
    cloudPending.delete(slot);const remote=CLOUD.idx?.slots?.[slot],user=CLOUD.uid;if(!user||!remote)return;
    try{await api('saves/'+encodeURIComponent(slot),'DELETE',{version:remote.version},user);if(user===CLOUD.uid){delete CLOUD.idx.slots[slot];rememberVersion(slot,null)}}
    catch{toast(W('La còpia del dispositiu s’ha esborrat, però no s’ha pogut esborrar la del núvol.','La copia del dispositivo se ha borrado, pero no se ha podido borrar la de la nube.'))}
  };
  cloudBlock=function() {
    let html=previousBlock();if(CLOUD.mode!=='cf'||!CLOUD.uid)return html;
    html=html.replace('Les partides es desen al dispositiu i se’n fan còpies periòdiques al núvol. Abans de canviar de dispositiu, prem «Desar al núvol ara».','Les partides es desen al dispositiu i se sincronitzen automàticament amb el núvol. Quan tornes al menú o passes a una altra app, s’intenten enviar els canvis pendents.').replace('Las partidas se guardan en el dispositivo y se hacen copias periódicas en la nube. Antes de cambiar de dispositivo, pulsa «Guardar en la nube ahora».','Las partidas se guardan en el dispositivo y se sincronizan automáticamente con la nube. Al volver al menú o pasar a otra app, se intentan enviar los cambios pendientes.');
    const loc=new Map(slotsList().map(m=>[remoteId(m.id),m]));
    const extra=Object.values(CLOUD.idx?.slots||{}).filter(m=>loc.has(m.id)&&m.upd<=(loc.get(m.id).upd||0)+5000);
    return `<p class="muted">${W('Sessió iniciada com a','Sesión iniciada como')} ${esc(CLOUD.name)}</p><p class="muted" data-cloud-menu-status>${esc(syncText())}</p>`+html+extra.map(m=>`<div class="row"><span>${esc(m.name)}</span><button class="btn" data-cloudget="${esc(m.id)}">☁ ${W('Carrega la còpia del núvol','Carga la copia de la nube')}</button></div>`).join('')+`<div class="row"><button class="btn small" data-cloudrefresh ${CLOUD.busy?'disabled':''}>${W('Actualitza les còpies del núvol','Actualiza las copias de la nube')}</button><button class="btn small" data-cloudlogout ${CLOUD.busy?'disabled':''}>${W('Tanca la sessió','Cerrar sesión')}</button></div>`;
  };
  document.addEventListener('click',async event=>{
    if(event.target.closest('[data-cloudrefresh]'))await cloudIndex();
    if(event.target.closest('[data-cloudlogout]')){
      try{await api('auth','DELETE');window.google?.accounts?.id?.disableAutoSelect();setUser(null);if(!S)render()}
      catch{toast(W('No s’ha pogut tancar la sessió. Comprova la connexió.','No se ha podido cerrar sesión. Comprueba la conexión.'))}
    }
  });
  function finishSession(){
    if(CLOUD.mode!=='cf'||!CLOUD.uid)return;
    if(Date.now()-lastFinish<1000)return;lastFinish=Date.now();
    if(S)save();
    cloudFlush(true);
  }
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')finishSession();else if(CLOUD.mode==='cf'&&CLOUD.uid&&!cloudRunning)cloudIndex()});
  window.addEventListener?.('pagehide',finishSession);
  document.addEventListener('click',event=>{if(event.target.closest('#bMenu,#bQuit,[data-step="menu"]'))finishSession()});
  // El joc ja s’ha iniciat quan es carrega aquest fitxer.
  // El temporitzador antic pot haver executat cloudInit abans de descarregar aquest script.
  if(isCloudflare)CLOUD.started=false;
  window.addEventListener?.('focus',()=>{if(CLOUD.mode==='cf'&&CLOUD.uid&&!cloudRunning)cloudIndex()});
  if(typeof setInterval==='function')setInterval(()=>{if(document.visibilityState==='visible'&&CLOUD.mode==='cf'&&CLOUD.uid&&!cloudRunning)cloudIndex()},30000);
  window.addEventListener?.('online',async()=>{if(!isCloudflare)return;if(!CLOUD.mode){CLOUD.started=false;await cloudInit()}else if(CLOUD.uid){cloudNext=0;await cloudIndex();if(S)save();cloudFlush(true)}});
  cloudInit();
})();
