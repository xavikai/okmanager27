/* Comprova la versió publicada quan tornes a l'app; recarrega només amb desament confirmat. */
(()=>{
  const version=document.querySelector('meta[name="hm27-version"]')?.content;
  let checking=false,busy=false,latest=null,banner=null;
  function show(){
    if(banner||!latest||latest===version)return;
    banner=document.createElement('div');banner.setAttribute('role','status');
    banner.style.cssText='position:fixed;top:8px;left:8px;right:8px;z-index:9000;padding:12px;background:#fff;color:#17243b;border:2px solid #1f6feb;border-radius:10px;box-shadow:0 2px 12px #0003;display:flex;gap:12px;align-items:center;flex-wrap:wrap';
    const label=document.createElement('span');label.textContent=W('Hi ha una actualització del joc. Desa la partida i carrega les correccions.','Hay una actualización del juego. Guarda la partida y carga las correcciones.');
    const button=document.createElement('button');button.className='btn primary';button.textContent=W('Desar i actualitzar','Guardar y actualizar');button.onclick=apply;
    banner.append(label,button);document.body.appendChild(banner);
  }
  async function check(){
    if(checking||navigator.onLine===false||!version)return;
    checking=true;
    try{
      const response=await fetch('data/app-version.json',{cache:'no-store'});if(!response.ok)return;
      const data=await response.json();if(typeof data.version!=='string')return;
      latest=data.version;if(latest!==version){show();navigator.serviceWorker?.getRegistration().then(r=>r?.update()).catch(()=>{})}
    }catch{}finally{checking=false}
  }
  async function apply(){
    if(busy)return;
    if(typeof ui!=='undefined'&&ui.match?.m?.live&&view==='partit'){toast(W('Acaba el partit abans d’actualitzar.','Termina el partido antes de actualizar.'));return}
    busy=true;
    try{
      // No recarregar sense connexió: podria tornar a obrir una versió antiga.
      const response=await fetch('index.html',{cache:'no-store'});if(!response.ok)throw Error('offline');
      const page=await response.text();if(!page.includes('content="'+latest+'"'))throw Error('version');
      if(S){
        save();const snapshot=JSON.stringify(S),key=slotKey(S.slot);
        let confirmed=false;try{confirmed=localStorage.getItem(key)===snapshot}catch{}
        if(!confirmed){await IDB.put(key,snapshot);confirmed=await IDB.get(key)===snapshot}
        if(!confirmed)throw Error('save');
      }
      // La còpia local confirmada conserva la partida també si el núvol està pendent.
      location.reload();
    }catch{toast(W('No s’ha pogut confirmar el desament o descarregar l’actualització. La partida continua oberta; torna-ho a provar amb connexió.','No se ha podido confirmar el guardado o descargar la actualización. La partida sigue abierta; vuelve a intentarlo con conexión.'))}
    finally{busy=false}
  }
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check()});
  window.addEventListener('online',check);setInterval(check,300000);check();
})();
