/* Instal·lació des de la web, sense passar per una botiga d'aplicacions. */
let installPrompt=null;
const installed=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
function refreshInstallPanel(){const panel=document.getElementById('installPanel');if(panel)panel.outerHTML=installPanel();const callout=document.getElementById('homeInstall');if(callout)callout.outerHTML=installCallout()}
function installCallout(){return installed()?'':`<section id="homeInstall" class="bevel" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;padding:16px;border:2px solid var(--accent);background:var(--panel)"><div><b>${W('Porta el joc a la pantalla d’inici','Lleva el juego a la pantalla de inicio')}</b><div class="muted">${W('Instal·lació gratuïta · mòbil, tauleta i ordinador','Instalación gratuita · móvil, tableta y ordenador')}</div></div><button class="btn primary" data-install-game style="padding:12px 22px;font-size:17px">↓ ${W('Instal·la l’aplicació','Instala la aplicación')}</button></section>`}
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;refreshInstallPanel()});
window.addEventListener('appinstalled',()=>{installPrompt=null;refreshInstallPanel()});
function installPanel(){
  if(installed())return '';
  return `<section id="installPanel" class="bevel panel" style="gap:10px">
    <h2>${W('Instal·la el joc al mòbil','Instala el juego en el móvil')}</h2>
    <p style="margin:0">${W('Gratuït. Obre’l des de la pantalla d’inici i juga al mode mànager sense connexió després de la primera càrrega.','Gratis. Ábrelo desde la pantalla de inicio y juega al modo mánager sin conexión después de la primera carga.')}</p>
    ${installPrompt?`<div><button class="btn primary" data-install-game>${W('Instal·lar el joc','Instalar el juego')}</button></div>`:''}
    <details><summary>${W('Com instal·lar-lo a Android o iPhone','Cómo instalarlo en Android o iPhone')}</summary>
      <p><b>Android:</b> ${W('obre aquesta web amb Chrome. Al menú ⋮, tria «Instal·la l’aplicació» o «Afegeix a la pantalla d’inici».','abre esta web con Chrome. En el menú ⋮, elige «Instalar aplicación» o «Añadir a pantalla de inicio».')}</p>
      <p><b>iPhone / iPad:</b> ${W('obre aquesta web amb Safari. Prem Compartir i després «Afegeix a la pantalla d’inici».','abre esta web con Safari. Pulsa Compartir y después «Añadir a pantalla de inicio».')}</p>
      <p class="muted">${W('Les partides es guarden en aquest dispositiu. Exporta una còpia abans d’esborrar les dades del navegador; amb el teu compte de Google també les pots desar al núvol i copiar-les a un altre dispositiu.','Las partidas se guardan en este dispositivo. Exporta una copia antes de borrar los datos del navegador; con tu cuenta de Google también puedes guardarlas en la nube y copiarlas a otro dispositivo.')}</p>
    </details></section>`;
}
document.addEventListener('click',async event=>{
  if(!event.target.closest('[data-install-game]'))return;
  if(!installPrompt){
    document.getElementById('installHelpDialog')?.remove();
    const dialog=document.createElement('dialog');dialog.id='installHelpDialog';dialog.style.cssText='max-width:min(620px,90vw);border-radius:14px;padding:22px';
    dialog.innerHTML=installPanel()+`<button class="btn" data-install-close>${W('Tanca','Cerrar')}</button>`;
    const details=dialog.querySelector('details');if(details)details.open=true;
    dialog.querySelector('[data-install-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove());document.body.appendChild(dialog);dialog.showModal();return;
  }
  const prompt=installPrompt;installPrompt=null;
  try{await prompt.prompt();await prompt.userChoice}finally{refreshInstallPanel()}
});
