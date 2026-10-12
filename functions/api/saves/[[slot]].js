import {session,readJson,originAllowed,now,json} from '../../../server/cloud.mjs';
import {reply} from '../../../server/requests.mjs';
const validSlot = slot => typeof slot==='string' && /^[A-Za-z0-9_-]{1,80}$/.test(slot);
export async function onRequest({request,env,params}) {
  if(!env.METRICS_DB)return reply(503,'Service unavailable');
  try {
    const user=await session(request,env);if(!user)return reply(401,'Sign-in required');
    if(request.headers.get('X-HM27-User')!==user.id)return reply(403,'Session changed');
    const slot=Array.isArray(params.slot)?params.slot.join('/'):params.slot||'';
    if(slot&&!validSlot(slot))return reply(400,'Invalid slot');
    if(request.method==='GET') {
      if(slot){const row=await env.METRICS_DB.prepare('SELECT data,compressed,version FROM game_saves WHERE user_id=? AND slot=?').bind(user.id,slot).first();return row?json({data:row.data,z:!!row.compressed,version:row.version}):reply(404,'Save not found')}
      const rows=await env.METRICS_DB.prepare('SELECT slot,metadata,version FROM game_saves WHERE user_id=?').bind(user.id).all();
      return json({slots:Object.fromEntries(rows.results.map(row=>[row.slot,{...JSON.parse(row.metadata),id:row.slot,version:row.version}]))});
    }
    if(!slot)return reply(400,'Slot required');
    if(!['PUT','DELETE'].includes(request.method))return reply(405,'Method not allowed');
    if(!originAllowed(request))return reply(403,'Forbidden');
    const parsed=await readJson(request);if(parsed.error)return parsed.error;
    const body=parsed.data;
    if(!body||!(body.version===null||typeof body.version==='string'))return reply(400,'Version required');
    if(request.method==='DELETE') {
      const result=await env.METRICS_DB.prepare('DELETE FROM game_saves WHERE user_id=? AND slot=? AND version=?').bind(user.id,slot,body.version).run();
      return result.meta.changes?json({ok:true}):reply(409,'Save changed on another device');
    }
    if(typeof body.data!=='string'||!body.data.length||body.data.length>1000000||typeof body.z!=='boolean'||!body.metadata||typeof body.metadata!=='object')return reply(400,'Invalid save');
    if(body.z&&!/^[A-Za-z0-9+/]+={0,2}$/.test(body.data))return reply(400,'Invalid compressed save');
    const m=body.metadata;
    if(typeof m.name!=='string'||typeof m.team!=='string'||!Number.isFinite(m.upd)||!Number.isInteger(m.season)||!Number.isInteger(m.round))return reply(400,'Invalid metadata');
    const metadata=JSON.stringify({id:slot,name:m.name.slice(0,100),team:m.team.slice(0,80),c1:/^#[0-9a-f]{3,8}$/i.test(m.c1)?m.c1:'#335',c2:/^#[0-9a-f]{3,8}$/i.test(m.c2)?m.c2:'#fff',season:m.season,round:m.round,div:String(m.div||'OK').slice(0,40),upd:m.upd});
    const version=crypto.randomUUID();let result;
    if(body.version===null){
      result=await env.METRICS_DB.prepare('INSERT INTO game_saves (user_id,slot,data,compressed,metadata,version,updated_at) SELECT ?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM game_saves WHERE user_id=?)<10 ON CONFLICT(user_id,slot) DO NOTHING').bind(user.id,slot,body.data,body.z?1:0,metadata,version,now(),user.id).run();
    }else{
      result=await env.METRICS_DB.prepare('UPDATE game_saves SET data=?,compressed=?,metadata=?,version=?,updated_at=? WHERE user_id=? AND slot=? AND version=?').bind(body.data,body.z?1:0,metadata,version,now(),user.id,slot,body.version).run();
    }
    if(!result.meta.changes)return reply(409,'Save changed or ten-save limit reached');
    return json({version});
  }catch{return reply(503,'Service unavailable')}
}
