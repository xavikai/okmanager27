import {session,sessionToken,hash,cookie,readJson,verifyGoogle,originAllowed,now,json} from '../../server/cloud.mjs';
import {reply} from '../../server/requests.mjs';
export async function onRequest({request,env}) {
  if(!env.METRICS_DB)return reply(503,'Service unavailable');
  try {
    if(request.method==='GET')return json({enabled:!!env.GOOGLE_CLIENT_ID,clientId:env.GOOGLE_CLIENT_ID||null,user:await session(request,env)});
    if(request.method==='DELETE') {
      if(!originAllowed(request))return reply(403,'Forbidden');
      const token=sessionToken(request);
      if(token)await env.METRICS_DB.prepare('DELETE FROM game_sessions WHERE token_hash=?').bind(await hash(token)).run();
      return json({ok:true},200,{'Set-Cookie':cookie('',0)});
    }
    if(request.method!=='POST')return reply(405,'Method not allowed');
    if(!env.GOOGLE_CLIENT_ID)return reply(503,'Google sign-in not configured');
    const parsed=await readJson(request,12000);if(parsed.error)return parsed.error;
    if(typeof parsed.data?.credential!=='string')return reply(400,'Credential required');
    let user;try{user=await verifyGoogle(parsed.data.credential,env.GOOGLE_CLIENT_ID)}catch{return reply(401,'Invalid Google credential')}
    const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
    const previous=sessionToken(request);
    await env.METRICS_DB.batch([
      env.METRICS_DB.prepare('INSERT INTO game_users (id,name,created_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name').bind(user.id,user.name,now()),
      env.METRICS_DB.prepare('DELETE FROM game_sessions WHERE expires_at<=? OR token_hash=?').bind(now(),await hash(previous)),
      env.METRICS_DB.prepare('INSERT INTO game_sessions (token_hash,user_id,expires_at) VALUES (?,?,?)').bind(await hash(token),user.id,now()+2592000)
    ]);
    return json({user},200,{'Set-Cookie':cookie(token)});
  }catch{return reply(503,'Service unavailable')}
}
