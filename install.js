/* Instal·lació des de la web, sense passar per una botiga d'aplicacions. */
let installPrompt=null;
const installed=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
function refreshInstallPanel(){const panel=document.getElementById('installPanel');if(panel)panel.outerHTML=installPanel()}
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
      <p class="muted">${W('Les partides es guarden en aquest dispositiu. Exporta una còpia abans d’esborrar les dades del navegador; quan el núvol estigui activat, també podràs continuar-les amb el teu compte de Google.','Las partidas se guardan en este dispositivo. Exporta una copia antes de borrar los datos del navegador; cuando la nube esté activada, también podrás continuarlas con tu cuenta de Google.')}</p>
    </details></section>`;
}
document.addEventListener('click',async event=>{
  if(!event.target.closest('[data-install-game]')||!installPrompt)return;
  const prompt=installPrompt;installPrompt=null;
  try{await prompt.prompt();await prompt.userChoice}finally{refreshInstallPanel()}
});
