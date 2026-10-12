/* Partides privades a Cloudflare D1. La identitat la valida el servidor. */
(() => {
  let clientId=null,identityReady=null,loginDialog=null,localVersions={};
  const previousInit=cloudInit,previousIndex=cloudIndex,previousLogin=cloudLogin;
  const previousFlush=cloudFlush,previousPull=cloudPull,previousDelete=cloudDelete;
  const previousBlock=cloudBlock;
  const isCloudflare=location.hostname==='hoquei-manager27.pages.dev';
  async function api(path,method='GET',body,user=CLOUD.uid) {
    const response=await fetch('/api/'+path,{method,credentials:'same-origin',cache:'no-store',headers:{...(body?{'Content-Type':'application/json'}:{}),...(user?{'X-HM27-User':user}:{})},...(body?{body:JSON.stringify(body)}:{})});
    if(!response.ok){const error=new Error('Cloud request failed');error.status=response.status;throw error}
    return response.json();
  }
  function setUser(user) {
    clearTimeout(cloudTimer);cloudTimer=null;cloudPending.clear();cloudNext=0;
    CLOUD.uid=user?.id||null;CLOUD.name=user?.name||'';CLOUD.idx=null;CLOUD.msg='';
    localVersions={};if(CLOUD.uid){try{localVersions=JSON.parse(localStorage.getItem('hm27-cloud-versions-'+CLOUD.uid)||'{}')}catch{}}
  }
  function rememberVersion(slot,version) {
    if(version)localVersions[slot]=version;else delete localVersions[slot];
    try{localStorage.setItem('hm27-cloud-versions-'+CLOUD.uid,JSON.stringify(localVersions))}catch{}
  }
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
  cloudIndex=async function() {
    if(CLOUD.mode!=='cf')return previousIndex();
    if(!CLOUD.uid)return;const user=CLOUD.uid;
    try{const index=await api('saves');if(user===CLOUD.uid){CLOUD.idx=index;CLOUD.msg=''}}
    catch(error){if(user===CLOUD.uid){CLOUD.idx=null;CLOUD.msg=W('No s’ha pogut llegir el núvol. Torna a iniciar sessió o comprova la connexió.','No se ha podido leer la nube. Vuelve a iniciar sesión o comprueba la conexión.');if(error.status===401)setUser(null)}}
    if(!S)render();
  };
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
    if(cloudRunning||!CLOUD.uid||!CLOUD.idx)return;
    if(!manual&&Date.now()<cloudNext){cloudSchedule();return}
    clearTimeout(cloudTimer);cloudTimer=null;
    const pending=Array.from(cloudPending.values());cloudPending.clear();if(!pending.length)return;
    const user=CLOUD.uid;cloudRunning=true;CLOUD.busy=true;cloudNext=Date.now()+120000;CLOUD.msg='';
    try{
      for(const item of pending){
        if(item.uid!==user||CLOUD.uid!==user)continue;
        const state=JSON.parse(item.j),metadata=slotMetaOf(state,item.slot),remote=CLOUD.idx.slots[item.slot];
        if(remote&&(remote.upd>metadata.upd+5000||localVersions[item.slot]!==remote.version)){CLOUD.msg=W('Hi ha una còpia del núvol que aquest dispositiu encara no ha carregat. Continua-la des del núvol abans de tornar a desar.','Hay una copia de la nube que este dispositivo todavía no ha cargado. Continúala desde la nube antes de volver a guardar.');continue}
        try{
          const compressed=await gz(item.j);if(CLOUD.uid!==user)continue;
          const result=await api('saves/'+encodeURIComponent(item.slot),'PUT',{data:compressed||item.j,z:!!compressed,metadata,version:remote?.version||null},user);
          if(CLOUD.uid===user){CLOUD.idx.slots[item.slot]={...metadata,version:result.version};rememberVersion(item.slot,result.version)}
        }catch(error){
          if(CLOUD.uid!==user)continue;
          if(error.status===409){await cloudIndex();CLOUD.msg=W('La partida ha canviat en un altre dispositiu o has arribat al límit de 10 partides al núvol. Revisa les còpies abans de tornar a desar.','La partida ha cambiado en otro dispositivo o has llegado al límite de 10 partidas en la nube. Revisa las copias antes de volver a guardar.');continue}
          if(!cloudPending.has(item.slot))cloudPending.set(item.slot,item);
          cloudNext=Date.now()+900000;CLOUD.msg=W('La còpia al núvol està pendent. La partida continua desada al dispositiu.','La copia en la nube está pendiente. La partida sigue guardada en el dispositivo.');
        }
      }
    }finally{cloudRunning=false;CLOUD.busy=false;cloudSchedule();if(!S)render()}
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
    const html=previousBlock();if(CLOUD.mode!=='cf'||!CLOUD.uid)return html;
    const loc=new Map(slotsList().map(m=>[m.id,m]));
    const extra=Object.values(CLOUD.idx?.slots||{}).filter(m=>loc.has(m.id)&&m.upd<=(loc.get(m.id).upd||0)+5000&&localVersions[m.id]!==m.version);
    return `<p class="muted">${W('Sessió iniciada com a','Sesión iniciada como')} ${esc(CLOUD.name)}</p>`+html+extra.map(m=>`<div class="row"><span>${esc(m.name)}</span><button class="btn" data-cloudget="${esc(m.id)}">☁ ${W('Carrega la còpia del núvol','Carga la copia de la nube')}</button></div>`).join('')+`<div class="row"><button class="btn small" data-cloudrefresh ${CLOUD.busy?'disabled':''}>${W('Actualitza les còpies del núvol','Actualiza las copias de la nube')}</button><button class="btn small" data-cloudlogout ${CLOUD.busy?'disabled':''}>${W('Tanca la sessió','Cerrar sesión')}</button></div>`;
  };
  document.addEventListener('click',async event=>{
    if(event.target.closest('[data-cloudrefresh]'))await cloudIndex();
    if(event.target.closest('[data-cloudlogout]')){
      try{await api('auth','DELETE');window.google?.accounts?.id?.disableAutoSelect();setUser(null);if(!S)render()}
      catch{toast(W('No s’ha pogut tancar la sessió. Comprova la connexió.','No se ha podido cerrar sesión. Comprueba la conexión.'))}
    }
  });
  // El joc ja s’ha iniciat quan es carrega aquest fitxer.
  // El temporitzador antic pot haver executat cloudInit abans de descarregar aquest script.
  if(isCloudflare)CLOUD.started=false;
  window.addEventListener?.('online',()=>{if(isCloudflare&&!CLOUD.mode){CLOUD.started=false;cloudInit()}});
  cloudInit();
})();
