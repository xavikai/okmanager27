import {createRemoteJWKSet, jwtVerify} from 'jose';
import {reply} from './requests.mjs';
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const COOKIE = '__Host-hm27-session';
export const now = () => Math.floor(Date.now()/1000);
export const cookie = (token, age=2592000) => `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
export async function hash(token) {
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
}
export function sessionToken(request) {
  return (request.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';
}
export async function session(request,env) {
  const token=sessionToken(request);
  if(!/^[0-9a-f]{64}$/.test(token)||!env.METRICS_DB)return null;
  const user=await env.METRICS_DB.prepare('SELECT u.id,u.name,EXISTS(SELECT 1 FROM game_creator_users c WHERE c.user_id=u.id) AS creator FROM game_sessions s JOIN game_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(await hash(token),now()).first();
  if(user){if(user.creator)user.creator=true;else delete user.creator}return user;
}
export function originAllowed(request) {return request.headers.get('Origin')===new URL(request.url).origin;}
export async function readJson(request,limit=1100000) {
  if(!originAllowed(request))return {error:reply(403,'Forbidden')};
  if((request.headers.get('Content-Type')||'').split(';')[0].trim()!=='application/json')return {error:reply(415,'JSON required')};
  let size=0,body='';const reader=request.body?.getReader(),decoder=new TextDecoder();
  if(reader){try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>limit){await reader.cancel();return {error:reply(413,'Save too large')}}body+=decoder.decode(part.value,{stream:true})}body+=decoder.decode()}finally{reader.releaseLock()}}
  try{return {data:JSON.parse(body)}}catch{return {error:reply(400,'Invalid JSON')}}
}
export async function verifyGoogle(credential,clientId) {
  const {payload}=await jwtVerify(credential,googleKeys,{audience:clientId,issuer:['https://accounts.google.com','accounts.google.com'],algorithms:['RS256'],maxTokenAge:'2h'});
  if(typeof payload.sub!=='string'||!payload.sub||!payload.exp)throw Error('Invalid identity');
  const user={id:payload.sub,name:typeof payload.given_name==='string'?payload.given_name.slice(0,80):'Jugador'};
  if(payload.email_verified===true&&typeof payload.email==='string'&&payload.email.toLowerCase()==='carrotrevoltstudio@gmail.com')user.creator=true;
  return user;
}
export function json(data,status=200,headers={}) {return Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});}
