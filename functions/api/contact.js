import {parsePost,reply} from '../../server/requests.mjs';
export async function onRequest({request,env}){
  const parsed=await parsePost(request);if(parsed.error)return parsed.error;
  const data=parsed.data;if(!data||typeof data!=='object')return reply(400,'Invalid request');
  const redirect=()=>Response.redirect(new URL('/gracies.html',request.url),303);
  if(data['bot-field'])return redirect();
  const name=typeof data.nom==='string'?data.nom.trim():'',email=typeof data.email==='string'?data.email.trim():'',message=typeof data.missatge==='string'?data.missatge.trim():'';
  if(name.length>100||email.length>200||!message||message.length>4000||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))return reply(400,'Comprova el correu i el missatge.');
  if(!env.METRICS_DB)return reply(503,'Torna-ho a provar més tard.');
  try{await env.METRICS_DB.prepare('INSERT INTO contact_messages (id,name,email,message) VALUES (?,?,?,?)').bind(crypto.randomUUID(),name,email,message).run();return redirect()}catch(e){return reply(503,'Torna-ho a provar més tard.')}
}
