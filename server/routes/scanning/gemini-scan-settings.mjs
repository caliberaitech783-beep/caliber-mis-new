import {configuredGeminiKey,geminiEnabled,MODEL} from '../../services/scanning/gemini-card-reader.mjs';

export function registerGeminiScanSettings(app,{store,requireSession,requireAdministrator,env=process.env,fetchImpl=fetch}) {
 const getConfig=async()=>{
  const saved=await store.read('gemini-scanning');
  if(saved)return saved;
  let apiKey='';
  if(geminiEnabled(env))try{apiKey=await configuredGeminiKey(env)}catch{}
  return {apiKey,enabled:geminiEnabled(env),verifiedAt:null};
 };
 const view=c=>({provider:'gemini',model:MODEL,configured:Boolean(c.apiKey),enabled:Boolean(c.enabled),verifiedAt:c.verifiedAt||null});
 let saving=false;
 const protect=[(req,res,next)=>{req.audit=false;res.set('Cache-Control','no-store');next()},requireSession,requireAdministrator];
 app.get('/api/gemini-settings',...protect,async(req,res)=>{
  try{res.json(view(await getConfig()))}catch{res.status(503).json({error:'Gemini settings could not be loaded.'})}
 });
 app.post('/api/gemini-settings',...protect,async(req,res)=>{
  if(saving)return res.status(409).json({error:'Another Gemini settings update is running. Please retry.'});
  saving=true;
  try{
   const old=await getConfig();
   if(req.body.enabled!==true&&req.body.enabled!==false)return res.status(400).json({error:'Choose whether to enable Gemini scanning.'});
   if(req.body.apiKey!==undefined&&typeof req.body.apiKey!=='string')return res.status(400).json({error:'Paste the API key text from Google AI Studio.'});
   const candidate=req.body.apiKey?.trim();
   if(candidate&&!/^[\x21-\x7e]{1,300}$/.test(candidate))return res.status(400).json({error:'The key contains spaces or unsupported characters inside it. Copy only the API key from Google AI Studio, without quotes or labels.'});
   const apiKey=candidate||old.apiKey;
   let verifiedAt=old.verifiedAt||null;
   if(req.body.enabled){
    if(!apiKey)return res.status(400).json({error:'Enter your Gemini API key.'});
    let response;
    try{response=await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}`,{headers:{'x-goog-api-key':apiKey},redirect:'error',signal:AbortSignal.timeout(15000)})}catch{return res.status(502).json({error:'Could not verify Gemini. Your previous settings were retained.'})}
    if(!response.ok)return res.status(400).json({error:`Gemini verification failed (HTTP ${response.status}). Check your key and model access. Your previous settings were retained.`});
    const data=await response.json();
    if(data.name!==`models/${MODEL}`||!data.supportedGenerationMethods?.includes('generateContent'))return res.status(400).json({error:'The configured Gemini model is not available for scanning. Your previous settings were retained.'});
    verifiedAt=new Date().toISOString();
   }
   const config={apiKey,enabled:req.body.enabled,verifiedAt};
   await store.write('gemini-scanning',config);
   res.json(view(config));
  }catch{res.status(503).json({error:'Gemini settings could not be saved. Please retry.'})}finally{saving=false}
 });
 return {getConfig};
}
