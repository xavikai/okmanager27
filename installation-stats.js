/* Un registre per navegador instal·lat. Les dades només es consulten
   al panell autenticat de Netlify; el joc no publica cap total. */
const INSTALL_STATS_KEY='hm27-installation-v1';
let installStatsSending=false;
function readInstallation(){try{return JSON.parse(localStorage.getItem(INSTALL_STATS_KEY)||'null')}catch(e){return null}}
function writeInstallation(record){try{localStorage.setItem(INSTALL_STATS_KEY,JSON.stringify(record));return true}catch(e){return false}}
async function recordInstallation(source){
  if(location.hostname!=='hoquei-manager27.netlify.app'||installStatsSending)return;
  let record=readInstallation();
  if(record&&record.sent)return;
  if(!record){
    if(!source||!window.crypto||!window.crypto.randomUUID)return;
    record={id:window.crypto.randomUUID(),source,sent:false};
    // Sense desament persistent no comptem cada obertura com una instal·lació nova.
    if(!writeInstallation(record))return;
  }
  if(navigator.onLine===false)return;
  installStatsSending=true;
  try{
    const response=await fetch('/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({'form-name':'installacions-app','installation_id':record.id,'detection':record.source,'bot-field':''}).toString(),keepalive:true});
    if(response.ok){record.sent=true;writeInstallation(record)}
  }catch(e){/* L'app funciona igual; es reintenta amb connexió o a la propera obertura. */}
  finally{installStatsSending=false}
}
window.addEventListener('appinstalled',()=>recordInstallation('confirmed-install'));
window.addEventListener('online',()=>recordInstallation(installed()?'standalone-first-open':null));
document.addEventListener('DOMContentLoaded',()=>recordInstallation(installed()?'standalone-first-open':null));
