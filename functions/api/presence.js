import {session,hash,now,readJson,json} from '../../server/cloud.mjs';
import {reply} from '../../server/requests.mjs';
export async function onRequest({request,env}) {
  if(!env.METRICS_DB)return reply(503,'Service unavailable');
  try {
    if(request.method==='GET') {
      const user=await session(request,env);
      if(!user)return reply(401,'Sign in required');
      if(!user.creator)return reply(403,'Forbidden');
      const since=now()-300;
      const users=await env.METRICS_DB.prepare('SELECT u.id,u.name,MAX(p.seen_at) AS seenAt FROM game_presence p JOIN game_users u ON u.id=p.user_id WHERE p.seen_at>=? GROUP BY u.id,u.name ORDER BY seenAt DESC').bind(since).all();
      const anonymous=await env.METRICS_DB.prepare('SELECT COUNT(*) AS count FROM game_presence WHERE user_id IS NULL AND seen_at>=?').bind(since).first();
      return json({users:users.results.map(({name,seenAt})=>({name,seenAt})),signedIn:users.results.length,anonymous:anonymous.count,windowSeconds:300});
    }
    if(request.method!=='POST')return reply(405,'Method not allowed');
    const parsed=await readJson(request,256);if(parsed.error)return parsed.error;
    if(!/^[0-9a-f]{64}$/.test(parsed.data?.visitor||''))return reply(400,'Invalid visitor');
    const user=await session(request,env),visitor=await hash(parsed.data.visitor);
    await env.METRICS_DB.batch([
      env.METRICS_DB.prepare('DELETE FROM game_presence WHERE seen_at<?').bind(now()-600),
      parsed.data.active===false
        ?env.METRICS_DB.prepare('DELETE FROM game_presence WHERE visitor_hash=?').bind(visitor)
        :env.METRICS_DB.prepare('INSERT INTO game_presence(visitor_hash,user_id,seen_at) VALUES(?,?,?) ON CONFLICT(visitor_hash) DO UPDATE SET user_id=excluded.user_id,seen_at=excluded.seen_at').bind(visitor,user?.id||null,now())
    ]);
    return json({ok:true});
  }catch{return reply(503,'Service unavailable')}
}
