// A service-specific 401 or a late response from an old login must not clear a
// newer, valid session. Only the session heartbeat can confirm revocation.
export function createSessionExpiryGuard({fetchImpl,getToken}) {
 const checks=new Map();
 return async(input,init,response)=>{
  if(response.status!==401)return false;
  const url=typeof input==='string'?input:input?.url||'';
  if(!url.startsWith('/api/')||url.startsWith('/api/login'))return false;
  const headers=new Headers(init?.headers||input?.headers);
  const token=String(headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
  if(!token||token!==getToken())return false;
  if(url==='/api/session-heartbeat')return true;
  if(!checks.has(token)){
   const check=(async()=>{
    try{const result=await fetchImpl('/api/session-heartbeat',{method:'POST',headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(8000)});return result.status===401}catch{return false}
   })().finally(()=>checks.delete(token));
   checks.set(token,check);
  }
  const expired=await checks.get(token);
  return expired&&getToken()===token;
 };
}
