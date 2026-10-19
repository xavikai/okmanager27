/* Identitat compartida entre la còpia local i la partida original del núvol. */
let cloudDownloadBusy=false;
const cloudLocalLinks=new Map(),cloudConflicts=new Map();
const cloudSyncHooks={version:()=>null,remember:()=>{}};
async function cloudFingerprint(state){const copy={...state};delete copy.slot;delete copy.upd;delete copy.cloudOrigin;const text=JSON.stringify(copy);if(typeof crypto!=='undefined'&&crypto.subtle){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('')}let a=2166136261,b=5381;for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b,33)^text.charCodeAt(i)}return (a>>>0).toString(16)+(b>>>0).toString(16)}
async function cloudLocalDirty(local){return !local.cloudOrigin?.syncedHash||await cloudFingerprint(local)!==local.cloudOrigin.syncedHash}
function cloudRemoteSlot(id,state){const o=state?.cloudOrigin;return o&&o.user===CLOUD.uid?o.slot:cloudLocalLinks.get(id)||id}
function cloudConflictMessage(){return cloudConflicts.size?W('Hi ha progrés diferent en dos dispositius. Les còpies es conserven; revisa el conflicte al menú.','Hay progreso diferente en dos dispositivos. Se conservan las copias; revisa el conflicto en el menú.'):''}
function cloudMarkConflict(id,local,slot){cloudConflicts.set(id,{user:CLOUD.uid,name:local.teams[local.user].name,slot});CLOUD.msg=cloudConflictMessage()}
function cloudDownloadButton(m){return CLOUD.mode==='cf'?`<button class="btn" data-cloudcopy="${esc(m.id)}" ${cloudDownloadBusy?'disabled':''}>↔ ${W('Sincronitza al dispositiu','Sincroniza en el dispositivo')}</button>`:''}
function cloudDownloadAllButton(){return CLOUD.mode==='cf'&&CLOUD.uid?`<p><button class="btn" data-cloudcopy-all ${cloudDownloadBusy||!CLOUD.idx?'disabled':''}>↔ ${W('Sincronitza les partides al dispositiu','Sincroniza las partidas en el dispositivo')}</button></p><p class="muted">${W('Cada partida manté una sola còpia vinculada al núvol en aquest dispositiu. Les partides locals diferents es conserven.','Cada partida mantiene una sola copia vinculada a la nube en este dispositivo. Se conservan las partidas locales distintas.')}</p>`:''}
async function cloudCopyWrite(key,text,requireLocal=false){
 try{localStorage.setItem(key,text)}catch{}
 if(requireLocal){try{if(localStorage.getItem(key)!==text)throw Error('Local index unavailable')}catch{throw Error('Local index unavailable')}}
 try{await IDB.put(key,text)}catch{}
 try{if(localStorage.getItem(key)===text)return}catch{}
 if(await IDB.get(key)!==text)throw Error('Local storage unavailable');
}
async function cloudReadSnapshot(slot,user=CLOUD.uid){
 const r=await fetch('/api/saves/'+encodeURIComponent(slot),{credentials:'same-origin',cache:'no-store',headers:{'X-HM27-User':user}});if(!r.ok)throw Error('Cloud unavailable');const result=await r.json(),state=JSON.parse(result.z?await gunz(result.data):result.data);
 if(CLOUD.uid!==user||!state?.teams||!state.players||!state.teams[state.user]||!Number.isFinite(state.season)||typeof result.version!=='string')throw Error('Invalid save or session changed');return {state,version:result.version};
}
async function cloudFindLocal(slot,user){
 for(const m of slotsList()){const local=await loadSlotAsync(m.id),o=local?.cloudOrigin;if(o?.user===user&&o.slot===slot)return {id:m.id,local}}
 const known=cloudSyncHooks.version(slot);if(known){const local=await loadSlotAsync(slot);if(local&&!local.cloudOrigin){const r=CLOUD.idx?.slots?.[slot];local.cloudOrigin={user,slot,version:known,syncedAt:r?.version===known?r.upd:-1};await cloudCopyWrite(slotKey(slot),JSON.stringify(local));return {id:slot,local}}}return null;
}
async function cloudStoreLinked(id,state,slot,version,user,expected){
 if(CLOUD.uid!==user||S)throw Error('Session changed');if(expected&&JSON.stringify(await loadSlotAsync(id))!==expected)throw Error('Local game changed');
 const copy=migrate(state);copy.slot=id;copy.cloudOrigin={user,slot,version,syncedAt:copy.upd||0,syncedHash:await cloudFingerprint(copy)};if(CLOUD.uid!==user||S)throw Error('Session changed');await cloudCopyWrite(slotKey(id),JSON.stringify(copy));if(CLOUD.uid!==user||S)throw Error('Session changed');
 const list=slotsList().filter(m=>m.id!==id);list.push(slotMetaOf(copy,id));await cloudCopyWrite(SLOTS_KEY,JSON.stringify(list),true);cloudLocalLinks.set(id,slot);cloudSyncHooks.remember(slot,version);cloudConflicts.delete(id);return id;
}
async function copyCloudToDevice(slot){
 const user=CLOUD.uid;if(!user||cloudDownloadBusy||S)return null;cloudDownloadBusy=true;render();
 try{const remote=await cloudReadSnapshot(slot,user),existing=await cloudFindLocal(slot,user);if(CLOUD.uid!==user||S)throw Error('Session changed');
  if(existing){const {id,local}=existing,o=local.cloudOrigin;cloudLocalLinks.set(id,slot);if(o.version===remote.version){if(!o.syncedHash){o.syncedAt=Math.min(local.upd||0,remote.state.upd||0);o.syncedHash=await cloudFingerprint(migrate(remote.state));if(CLOUD.uid!==user||S)throw Error('Session changed');await cloudCopyWrite(slotKey(id),JSON.stringify(local))}return id}
   if(await cloudLocalDirty(local)){cloudMarkConflict(id,local,slot);return null}return await cloudStoreLinked(id,remote.state,slot,remote.version,user,JSON.stringify(local));}
  return await cloudStoreLinked('cloud-'+crypto.randomUUID(),remote.state,slot,remote.version,user);
 }catch{toast(W('No s’ha pogut sincronitzar. El progrés del dispositiu es conserva.','No se ha podido sincronizar. Se conserva el progreso del dispositivo.'));return null}
 finally{cloudDownloadBusy=false;if(!S)render()}
}
async function cloudReconcileLinked(index,user){
 for(const m of slotsList()){if(CLOUD.uid!==user)return;const local=await loadSlotAsync(m.id),o=local?.cloudOrigin;if(!o||o.user!==user)continue;cloudLocalLinks.set(m.id,o.slot);const r=index.slots[o.slot];if(!r){cloudMarkConflict(m.id,local,o.slot);continue}
  if(!o.syncedHash&&o.version===r.version){const expected=JSON.stringify(local),base=await cloudReadSnapshot(o.slot,user);if(base.version!==o.version){cloudMarkConflict(m.id,local,o.slot);continue}o.syncedAt=Math.min(local.upd||0,r.upd||0);o.syncedHash=await cloudFingerprint(migrate(base.state));if(CLOUD.uid!==user)return;if(JSON.stringify(await loadSlotAsync(m.id))!==expected)continue;await cloudCopyWrite(slotKey(m.id),JSON.stringify(local))}
  const dirty=await cloudLocalDirty(local);if(CLOUD.uid!==user)return;
  if(o.version===r.version){cloudConflicts.delete(m.id);if(dirty&&(!S||S.slot!==m.id))cloudQueue(m.id,JSON.stringify(local));continue}
  if(S?.slot===m.id||dirty){cloudMarkConflict(m.id,local,o.slot);continue}if(!S&&!cloudDownloadBusy)await copyCloudToDevice(o.slot);
 }
}
async function cloudPrepareLocal(){if(CLOUD.uid&&navigator.onLine!==false)await cloudIndex()}
async function cloudAcknowledge(id,slot,oldVersion,newVersion,uploadedAt,user,fingerprint){
 if(CLOUD.uid!==user)return;const local=await loadSlotAsync(id);if(CLOUD.uid!==user)return;
 const update=st=>{const o=st?.cloudOrigin;if(o?.user===user&&o.slot===slot&&o.version===oldVersion){o.version=newVersion;o.syncedAt=uploadedAt;o.syncedHash=fingerprint;return true}return false};
 if(update(local))await cloudCopyWrite(slotKey(id),JSON.stringify(local));if(CLOUD.uid===user&&S?.slot===id)update(S);cloudConflicts.delete(id);
}
function cloudBackupIndex(){try{return JSON.parse(localStorage.getItem('hm27-sync-backups-'+CLOUD.uid)||'[]')}catch{return []}}
function cloudConflictPanel(){
 if(!CLOUD.uid)return '';const conflicts=Array.from(cloudConflicts.entries()).filter(([,x])=>x.user===CLOUD.uid),backups=cloudBackupIndex();if(!conflicts.length&&!backups.length)return '';
 return `<section class="bevel panel"><h2>${W('Progrés entre dispositius','Progreso entre dispositivos')}</h2>${conflicts.map(([id,x])=>`<p><b>${esc(x.name)}</b>: ${W('hi ha canvis locals i una revisió diferent al núvol. No s’ha sobreescrit cap progrés.','hay cambios locales y una revisión distinta en la nube. No se ha sobrescrito ningún progreso.')}</p><button class="btn" data-sync-use-cloud="${esc(id)}">${W('Carrega el núvol i conserva una còpia local anterior','Carga la nube y conserva una copia local anterior')}</button>`).join('')}${backups.map(b=>`<p><button class="btn small" data-sync-backup="${esc(b.key)}">${W('Exporta la còpia anterior de','Exporta la copia anterior de')} ${esc(b.name)}</button></p>`).join('')}</section>`;
}
async function cloudUseRemote(id){
 const user=CLOUD.uid;if(!user||S||cloudDownloadBusy)return;cloudDownloadBusy=true;
 try{const local=await loadSlotAsync(id),o=local?.cloudOrigin;if(o?.user!==user)throw Error('Session changed');const expected=JSON.stringify(local),key='hm27-sync-backup-'+crypto.randomUUID();await cloudCopyWrite(key,expected);const backups=cloudBackupIndex();backups.push({key,name:local.teams[local.user].name});await cloudCopyWrite('hm27-sync-backups-'+user,JSON.stringify(backups),true);const remote=await cloudReadSnapshot(o.slot,user);await cloudStoreLinked(id,remote.state,o.slot,remote.version,user,expected);CLOUD.msg=cloudConflictMessage()}
 catch{toast(W('No s’ha pogut completar el canvi. La partida local es conserva.','No se ha podido completar el cambio. Se conserva la partida local.'))}finally{cloudDownloadBusy=false;if(!S)render()}
}
document.addEventListener('click',async event=>{
 const b=event.target.closest('[data-cloudcopy]');if(b&&!S){if(await copyCloudToDevice(b.dataset.cloudcopy))toast(W('Partida vinculada al núvol i desada al dispositiu.','Partida vinculada a la nube y guardada en el dispositivo.'));return}
 if(event.target.closest('[data-cloudcopy-all]')&&!S&&!cloudDownloadBusy){const user=CLOUD.uid;for(const slot of Object.keys(CLOUD.idx?.slots||{})){if(user!==CLOUD.uid||S)break;if(!await copyCloudToDevice(slot))break}return}
 const resolve=event.target.closest('[data-sync-use-cloud]');if(resolve&&!S){await cloudUseRemote(resolve.dataset.syncUseCloud);return}
 const backup=event.target.closest('[data-sync-backup]');if(backup&&!S){const entry=cloudBackupIndex().find(b=>b.key===backup.dataset.syncBackup);if(!entry)return;const data=localStorage.getItem(entry.key)||await IDB.get(entry.key);if(data){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({app:'hoquei-manager-27',v:4,S:JSON.parse(data)})],{type:'application/json'}));a.download='hoquei-manager-copia-anterior.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}}
});
