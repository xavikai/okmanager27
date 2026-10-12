import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import {onRequest as auth} from '../functions/api/auth.js';
import {onRequest as saves} from '../functions/api/saves/[[slot]].js';
import {hash,now} from '../server/cloud.mjs';
const origin='https://hoquei-manager27.pages.dev',client='test.apps.googleusercontent.com';
function database(){
  const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../migrations/0002_cloud_saves.sql',import.meta.url),'utf8'));
  const adapter={prepare(sql){const stmt=db.prepare(sql);let args=[];return {bind(...values){args=values;return this},async first(){return stmt.get(...args)||null},async all(){return {results:stmt.all(...args)}},async run(){const result=stmt.run(...args);return {meta:{changes:result.changes}}}}},async batch(items){db.exec('BEGIN');try{const results=[];for(const item of items)results.push(await item.run());db.exec('COMMIT');return results}catch(error){db.exec('ROLLBACK');throw error}}};
  return {db,env:{METRICS_DB:adapter,GOOGLE_CLIENT_ID:client}};
}
function request(path,method='GET',body,token,user,source=origin){return new Request(origin+'/api/'+path,{method,headers:{Origin:source,...(body?{'Content-Type':'application/json'}:{}),...(token?{Cookie:'__Host-hm27-session='+token}:{}),...(user?{'X-HM27-User':user}:{})},...(body?{body:JSON.stringify(body)}:{})})}
async function seed(db,user,token){db.prepare('INSERT INTO game_users VALUES (?,?,?)').run(user,user,now());db.prepare('INSERT INTO game_sessions VALUES (?,?,?)').run(await hash(token),user,now()+3600)}
const meta={name:'Equip',team:'BAR',season:2026,round:0,upd:Date.now()};
const body=(version=null)=>({data:'{"season":2026,"round":0}',z:false,metadata:meta,version});
test('private saves, optimistic concurrency, limits and sign-out',async()=>{
  const {db,env}=database(),a='a'.repeat(64),b='b'.repeat(64);await seed(db,'alice',a);await seed(db,'bob',b);
  const call=(method,slot,body,token=a,user='alice',source=origin)=>saves({request:request('saves/'+slot,method,body,token,user,source),env,params:{slot:slot?[slot]:[]}});
  assert.equal((await call('GET','')).status,200);
  assert.equal((await call('GET','','',null)).status,401);
  assert.equal((await call('PUT','one',body(),a,'bob')).status,403);
  assert.equal((await call('PUT','one',body(),a,'alice','https://attacker.example')).status,403);
  const created=await call('PUT','one',body());assert.equal(created.status,200);const first=(await created.json()).version;
  assert.equal((await call('GET','one',null,b,'bob')).status,404);
  assert.deepEqual((await (await call('GET','',null,b,'bob')).json()).slots,{});
  assert.equal((await call('PUT','one',body())).status,409);
  const updated=await call('PUT','one',body(first));assert.equal(updated.status,200);const second=(await updated.json()).version;
  assert.equal((await call('PUT','one',body(first))).status,409);
  assert.equal((await call('DELETE','one',{version:second},b,'bob')).status,409);
  assert.equal((await call('DELETE','one',{version:first})).status,409);
  assert.equal((await call('PUT','bad/slot',body())).status,400);
  assert.equal((await call('PUT','big',{...body(),data:'x'.repeat(1000001)})).status,400);
  for(let i=2;i<=10;i++)assert.equal((await call('PUT','slot'+i,body())).status,200);
  assert.equal((await call('PUT','slot11',body())).status,409);
  assert.equal((await call('DELETE','one',{version:second})).status,200);
  const logout=await auth({request:request('auth','DELETE',null,a),env});assert.equal(logout.status,200);assert.match(logout.headers.get('Set-Cookie'),/HttpOnly; Secure; SameSite=Strict; Max-Age=0/);
  assert.equal((await call('GET','')).status,401);
  assert.equal((await call('GET','',null,b,'bob')).status,200);
  db.close();
});
test('Google signature, audience, expiry, session cookie and disabled configuration',async()=>{
  const {db,env}=database();const {privateKey,publicKey}=await generateKeyPair('RS256');const key=await exportJWK(publicKey);key.kid='test';key.alg='RS256';
  const originalFetch=globalThis.fetch;globalThis.fetch=async()=>Response.json({keys:[key]},{headers:{'Cache-Control':'public, max-age=3600'}});
  const token=async(aud=client,exp=now()+3600)=>new SignJWT({given_name:'Anna'}).setProtectedHeader({alg:'RS256',kid:'test'}).setIssuer('https://accounts.google.com').setSubject('google-user').setAudience(aud).setIssuedAt(now()).setExpirationTime(exp).sign(privateKey);
  try{
    assert.equal((await auth({request:request('auth','POST',{credential:await token('wrong-client')}),env})).status,401);
    assert.equal((await auth({request:request('auth','POST',{credential:await token(client,now()-1)}),env})).status,401);
    assert.equal((await auth({request:request('auth','POST',{credential:'forged'}),env})).status,401);
    assert.equal((await auth({request:request('auth','POST',{credential:await token()},null,null,'https://attacker.example'),env})).status,403);
    const response=await auth({request:request('auth','POST',{credential:await token()}),env});assert.equal(response.status,200);assert.deepEqual((await response.json()).user,{id:'google-user',name:'Anna'});
    const cookie=response.headers.get('Set-Cookie');assert.match(cookie,/HttpOnly; Secure; SameSite=Strict/);const sessionToken=cookie.split(';')[0].split('=')[1];
    assert.equal(db.prepare('SELECT token_hash FROM game_sessions').get().token_hash,await hash(sessionToken));
    assert.notEqual(db.prepare('SELECT token_hash FROM game_sessions').get().token_hash,sessionToken);
    assert.equal((await (await auth({request:request('auth','GET',null,sessionToken),env})).json()).user.id,'google-user');
    const disabled={...env,GOOGLE_CLIENT_ID:undefined};assert.equal((await (await auth({request:request('auth'),env:disabled})).json()).enabled,false);
    assert.equal((await auth({request:request('auth','POST',{credential:await token()}),env:disabled})).status,503);
  }finally{globalThis.fetch=originalFetch;db.close()}
});
