export function reply(status,message){return Response.json({message},{status,headers:{'Cache-Control':'no-store'}})}
export async function parsePost(request){
  if(request.method!=='POST')return {error:reply(405,'Method not allowed')};
  if(request.headers.get('Origin')!==new URL(request.url).origin)return {error:reply(403,'Forbidden')};
  const type=(request.headers.get('Content-Type')||'').split(';')[0].trim();
  if(!['application/json','application/x-www-form-urlencoded'].includes(type))return {error:reply(415,'Unsupported content type')};
  const reader=request.body?.getReader();let size=0,text='',decoder=new TextDecoder();
  if(reader){try{while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>16384){await reader.cancel();return {error:reply(413,'Request too large')}}text+=decoder.decode(chunk.value,{stream:true})}text+=decoder.decode()}finally{reader.releaseLock()}}
  try{return {data:type==='application/json'?JSON.parse(text):Object.fromEntries(new URLSearchParams(text))}}catch(e){return {error:reply(400,'Invalid request')}}
}
