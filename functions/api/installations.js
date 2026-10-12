import {parsePost,reply} from '../../server/requests.mjs';
export async function onRequest({request,env}){
  const parsed=await parsePost(request);if(parsed.error)return parsed.error;
  const data=parsed.data;
  if(!data||typeof data.installation_id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.installation_id)||!['confirmed-install','standalone-first-open'].includes(data.detection))return reply(400,'Invalid installation');
  if(!env.METRICS_DB)return reply(503,'Service unavailable');
  try{
    await env.METRICS_DB.prepare('INSERT OR IGNORE INTO installations (id,detection,source_host) VALUES (?,?,?)').bind(data.installation_id,data.detection,new URL(request.url).hostname).run();
    return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}});
  }catch(e){return reply(503,'Service unavailable')}
}
