/* Sortida des del menú; les partides es conserven al dispositiu. */
(() => {
  function exitApp(){
    if(S||MODE==='fantasy'||APP_EXITED)return;
    APP_EXITED=true;
    if(MZ.audio){MZ.audio.pause();MZ.audio.currentTime=0}
    if(SND.ctx){const pending=SND.ctx.suspend();if(pending?.catch)pending.catch(()=>{})}
    const app=document.getElementById('app');
    app.innerHTML=`<section class="bevel panel" style="max-width:480px;margin:12vh auto;text-align:center;align-items:center;padding:32px"><span aria-hidden="true" style="font-size:36px;color:var(--accent)">⏻</span><h2>${W('Sortida del joc','Salida del juego')}</h2><p style="margin:0">${W('Ja pots tancar aquesta pestanya o l’app. Les partides guardades es conserven.','Ya puedes cerrar esta pestaña o la app. Las partidas guardadas se conservan.')}</p><button class="btn" data-app-return>${W('Tornar al menú','Volver al menú')}</button></section>`;
    for(const id of ['sndBtn','musBtn']){const b=document.getElementById(id);if(b)b.hidden=true}
    window.scrollTo(0,0);
    try{window.close()}catch{}
  }
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-app-exit]')){event.preventDefault();exitApp();return}
    if(event.target.closest('[data-app-return]')&&APP_EXITED){
      APP_EXITED=false;const b=document.getElementById('sndBtn');if(b)b.hidden=false;
      if(SND.on&&SND.ctx){const pending=SND.ctx.resume();if(pending?.catch)pending.catch(()=>{})}
      render();
    }
  });
})();
