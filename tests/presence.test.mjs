import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import {onRequest as presence} from '../functions/api/presence.js';
import {onRequest as auth} from '../functions/api/auth.js';
import {hash,now} from '../server/cloud.mjs';
const origin='https://hoquei-manager27.pages.dev';
function setup(){
 const db=new DatabaseSync(':memory:');for(const f of ['0002_cloud_saves.sql','0003_presence.sql'])db.exec(readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8'));
 const adapter={prepare(sql){const stmt=db.prepare(sql);let args=[];return {bind(...a){args=a;return this},async first(){return stmt.get(...args)||null},async all(){return {results:stmt.all(...args)}},async run(){return stmt.run(...args)}}},async batch(items){db.exec('BEGIN');try{const results=[];for(const item of items)results.push(await item.run());db.exec('COMMIT');return results}catch(e){db.exec('ROLLBACK');throw e}}};return {db,env:{METRICS_DB:adapter,GOOGLE_CLIENT_ID:'test.apps.googleusercontent.com'}};
}
function req(method='GET',body,token,source=origin){return new Request(origin+'/api/presence',{method,headers:{Origin:source,'Content-Type':'application/json',...(token?{Cookie:'__Host-hm27-session='+token}:{})},...(body?{body:JSON.stringify(body)}:{})})}
async function seed(db,id,token,creator=false){db.prepare('INSERT INTO game_users VALUES (?,?,?)').run(id,id,now());db.prepare('INSERT INTO game_sessions VALUES (?,?,?)').run(await hash(token),id,now()+3600);if(creator)db.prepare('INSERT INTO game_creator_users VALUES (?)').run(id)}
test('presence is private at the server, groups accounts and expires anonymous visits',async()=>{
 const {db,env}=setup(),owner='a'.repeat(64),other='b'.repeat(64),v='1'.repeat(64);await seed(db,'Creator',owner,true);await seed(db,'Anna',other);
 const call=(method,body,token,source)=>presence({request:req(method,body,token,source),env});
 assert.equal((await call('GET')).status,401);assert.equal((await call('GET',null,other)).status,403);
 assert.equal((await call('POST',{visitor:v,user_id:'Creator',creator:true},other,'https://attacker.example')).status,403);
 assert.equal((await call('POST',{visitor:v,user_id:'Creator',creator:true},other)).status,200);
 await call('POST',{visitor:'2'.repeat(64)},other);await call('POST',{visitor:'3'.repeat(64)});
 const data=await (await call('GET',null,owner)).json();assert.equal(data.signedIn,1);assert.equal(data.anonymous,1);assert.equal(data.users[0].name,'Anna');assert.equal(data.users[0].id,undefined);
 assert.equal(db.prepare('SELECT user_id FROM game_presence WHERE visitor_hash=?').get(await hash(v)).user_id,'Anna');
 await call('POST',{visitor:'3'.repeat(64),active:false});assert.equal((await (await call('GET',null,owner)).json()).anonymous,0);
 db.prepare('UPDATE game_presence SET seen_at=?').run(now()-301);assert.equal((await (await call('GET',null,owner)).json()).signedIn,0);
 db.prepare('UPDATE game_presence SET seen_at=?').run(now()-601);await call('POST',{visitor:'4'.repeat(64)});assert.equal(db.prepare('SELECT COUNT(*) AS n FROM game_presence').get().n,1);
 assert.equal((await call('POST',{visitor:'bad'})).status,400);db.close();
});
test('only a signed Google credential with the exact verified creator email grants access',async()=>{
 const {db,env}=setup(),{privateKey,publicKey}=await generateKeyPair('RS256'),jwk=await exportJWK(publicKey);jwk.kid='presence';jwk.alg='RS256';
 const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({keys:[jwk]});
 const credential=async(sub,email,verified)=>new SignJWT({given_name:'Creator',email,email_verified:verified}).setProtectedHeader({alg:'RS256',kid:'presence'}).setSubject(sub).setIssuer('https://accounts.google.com').setAudience(env.GOOGLE_CLIENT_ID).setIssuedAt(now()).setExpirationTime(now()+3600).sign(privateKey);
 try{for(const [sub,email,verified,allowed] of [['owner','carrotrevoltstudio@gmail.com',true,true],['fake','carrotrevoltstudio@gmail.com',false,false],['similar','carrotrevoltstudio@gmail.com.attacker.test',true,false],['ordinary','other@gmail.com',true,false]]){
   const response=await auth({request:req('POST',{credential:await credential(sub,email,verified),creator:true}),env});assert.equal(response.status,200);const user=(await response.json()).user;assert.equal(!!user.creator,allowed);
   const token=response.headers.get('Set-Cookie').split(';')[0].split('=')[1];assert.equal((await presence({request:req('GET',null,token),env})).status,allowed?200:403);
 }}finally{globalThis.fetch=original;db.close()}
});
