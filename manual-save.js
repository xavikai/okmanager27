/* Botó de desament accessible des de qualsevol pantalla del mànager. */
(()=>{
  let saving=false;
  document.addEventListener('click',async event=>{
    const button=event.target.closest('[data-manual-save],#bSave');
    if(!button||!S)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(saving)return;
    saving=true;
    const buttons=Array.from(document.querySelectorAll('[data-manual-save],#bSave'));
    const labels=buttons.map(b=>b.innerHTML);
    buttons.forEach(b=>{b.disabled=true;b.textContent=W('Desant…','Guardando…')});
    try{
      save();
      if(!await localSaveConfirmed())throw Error('local save failed');
      const slot=S.slot,updated=S.upd,user=CLOUD.uid;
      if(CLOUD.mode==='cf'&&user){
        await cloudFlush(true);
        const deadline=Date.now()+10000;
        while(CLOUD.uid===user&&!CLOUD.msg&&(cloudRunning||cloudPending.size)&&Date.now()<deadline){
          await new Promise(resolve=>setTimeout(resolve,100));
        }
        const confirmed=CLOUD.uid===user&&!CLOUD.msg&&(CLOUD.idx?.slots?.[typeof cloudRemoteSlot==="function"?cloudRemoteSlot(slot,S):slot]?.upd||0)>=updated;
        toast(confirmed?W('Partida desada al dispositiu i al núvol.','Partida guardada en el dispositivo y en la nube.'):W('Partida desada al dispositiu. La còpia al núvol encara no s’ha confirmat; comprova l’estat de sincronització.','Partida guardada en el dispositivo. La copia en la nube aún no se ha confirmado; comprueba el estado de sincronización.'));
      }else{
        toast(W('Partida desada al dispositiu. Inicia sessió amb Google per desar-la al núvol.','Partida guardada en el dispositivo. Inicia sesión con Google para guardarla en la nube.'));
      }
    }catch{
      toast(W('No s’ha pogut confirmar el desament. Torna-ho a provar.','No se ha podido confirmar el guardado. Vuelve a intentarlo.'));
    }finally{
      saving=false;buttons.forEach((b,i)=>{b.disabled=false;b.innerHTML=labels[i]});
    }
  },true);
})();
