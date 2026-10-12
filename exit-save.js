/* Confirmació de sortida del mànager. El núvol continua desant durant el joc. */
(() => {
  let dialog=null,busy=false;
  const cloudActive=()=>CLOUD.mode==='cf'&&!!CLOUD.uid;
  const pending=()=>cloudActive()&&(cloudRunning||cloudPending.size>0||!!CLOUD.msg);
  function close(){if(busy)return;dialog?.remove();dialog=null}
  function leave(){
    if(ticker){clearInterval(ticker);ticker=null}
    S=null;startStep='menu';view='inici';busy=false;close();render();window.scrollTo(0,0);
    const badge=document.querySelector('[data-cloud-status]');if(badge)badge.hidden=true;
  }
  async function saveAndLeave(){
    if(busy||!S)return;busy=true;
    dialog.querySelector('[data-exit-message]').textContent=W('Desant la partida…','Guardando la partida…');
    dialog.querySelectorAll('button').forEach(button=>button.disabled=true);
    save();
    if(cloudActive()){
      cloudFlush(true).catch(()=>{CLOUD.msg=W('No s’ha confirmat la còpia del núvol.','No se ha confirmado la copia de la nube.')});
      const end=Date.now()+10000;
      while((cloudRunning||cloudPending.size)&&!CLOUD.msg&&Date.now()<end)await new Promise(resolve=>setTimeout(resolve,100));
      if(pending()||!CLOUD.idx){
        busy=false;
        dialog.querySelector('[data-exit-message]').textContent=W('La partida està desada al dispositiu, però la còpia del núvol no s’ha confirmat. Pots tornar-ho a provar o sortir amb la còpia local.','La partida está guardada en el dispositivo, pero la copia de la nube no se ha confirmado. Puedes volver a intentarlo o salir con la copia local.');
        dialog.querySelector('[data-exit-local]').hidden=false;
        dialog.querySelectorAll('button').forEach(button=>button.disabled=false);return;
      }
    }
    leave();toast(W('Partida desada.','Partida guardada.'));
  }
  function show(){
    if(dialog||!S)return;
    dialog=document.createElement('dialog');dialog.setAttribute('aria-labelledby','exit-save-title');
    dialog.style.cssText='max-width:460px;width:calc(100vw - 48px);padding:24px;border:0;border-radius:14px;box-shadow:0 12px 60px #0005;color:var(--fg,#0f1722);background:var(--panel,#fff);border:1px solid var(--line,#e3e8ef)';
    dialog.innerHTML=`<h2 id="exit-save-title">${W('Desar partida abans de sortir?','¿Guardar partida antes de salir?')}</h2><p data-exit-message>${cloudActive()?W('Desarem la còpia local i esperarem la confirmació del núvol abans de tornar al menú.','Guardaremos la copia local y esperaremos la confirmación de la nube antes de volver al menú.'):W('Desarem la partida al dispositiu abans de tornar al menú. Inicia sessió amb Google si també vols guardar-la al núvol.','Guardaremos la partida en el dispositivo antes de volver al menú. Inicia sesión con Google si también quieres guardarla en la nube.')}</p><div class="row"><button class="btn primary" data-exit-save>${W('Desar i sortir','Guardar y salir')}</button><button class="btn" data-exit-cancel>${W('Continuar jugant','Seguir jugando')}</button><button class="btn" data-exit-local hidden>${W('Sortir amb còpia local','Salir con copia local')}</button></div>`;
    document.body.appendChild(dialog);if(!document.getElementById('exit-save-css')){const st=document.createElement('style');st.id='exit-save-css';st.textContent='dialog[aria-labelledby=exit-save-title]::backdrop{background:rgba(0,0,0,.6)}dialog[aria-labelledby=exit-save-title] h2{margin:0 0 8px;color:var(--fg)}dialog[aria-labelledby=exit-save-title] p{color:var(--fg)}';document.head.appendChild(st)}
    dialog.querySelector('[data-exit-save]').onclick=saveAndLeave;
    dialog.querySelector('[data-exit-cancel]').onclick=close;
    dialog.querySelector('[data-exit-local]').onclick=()=>{save();leave()};
    dialog.addEventListener('cancel',event=>{event.preventDefault();close()});
    dialog.showModal();dialog.querySelector('[data-exit-save]').focus();
  }
  document.addEventListener('click',event=>{
    if(!S||!event.target.closest('#bMenu,#bQuit'))return;
    if(ui.match?.m?.live&&view==='partit')return;
    event.preventDefault();event.stopImmediatePropagation();show();
  },true);
  window.addEventListener('beforeunload',event=>{
    if(!pending())return;
    event.preventDefault();event.returnValue='';
  });
})();
