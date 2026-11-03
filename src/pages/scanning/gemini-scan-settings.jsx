import React,{useEffect,useState} from 'react';

export default function GeminiScanSettings({session}) {
 const [settings,setSettings]=useState(null),[apiKey,setApiKey]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const call=async(body)=>{
  const response=await fetch('/api/gemini-settings',{method:body?'POST':'GET',headers:{Authorization:`Bearer ${session.token}`,'Content-Type':'application/json'},cache:'no-store',...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Gemini settings are unavailable.');return data;
 };
 useEffect(()=>{let cancelled=false;call().then(data=>{if(!cancelled)setSettings(data)}).catch(e=>{if(!cancelled)setError(e.message)});return()=>{cancelled=true}},[session.token]);
 const save=async(enabled)=>{
  setBusy(true);setError('');setMessage('');
  const candidate=apiKey.trim();
  try{setSettings(await call({enabled,...(candidate?{apiKey:candidate}:{})}));setApiKey('');setMessage(enabled?'Gemini key verified and saved. New scans will use Gemini.':'Gemini scanning disabled. The encrypted key is retained.')}catch(e){setError(e.message)}finally{setBusy(false)}
 };
 return <section className="panel"><h1>Gemini OCR settings</h1>
  <p>Connect Gemini to read scanned trip cards and job cards. When enabled, scanned card images are sent to Google for extraction. Review extracted values before logging.</p>
  {error&&<p role="alert">{error}</p>}
  {settings&&<><p><strong>{settings.enabled?'Gemini enabled':'Gemini disabled'}</strong> · {settings.configured?'Key configured':'No key configured'} · Model: {settings.model}</p>
   <form onSubmit={e=>{e.preventDefault();void save(true)}}>
    <label>Gemini API key<input name="geminiApiKey" type="password" autoComplete="off" spellCheck={false} autoCapitalize="none" maxLength={500} value={apiKey} onChange={e=>{setApiKey(e.target.value);setError('')}} disabled={busy} placeholder={settings.configured?'Leave blank to reuse the saved key':'Enter your Gemini API key'}/></label>
    <p>The key is encrypted on the server and is never returned to your browser. Saving verifies model access; a card scan is still needed to verify extraction and quota.</p>
    <button type="submit" disabled={busy||!apiKey&&!settings.configured}>{busy?'Please wait…':'Verify, save and enable Gemini'}</button>{' '}
    <button type="button" disabled={busy||!settings.enabled} onClick={()=>void save(false)}>Disable Gemini</button>
   </form>
   {settings.verifiedAt&&<p>Last key verification: {new Date(settings.verifiedAt).toLocaleString()}</p>}
  </>}
  {message&&<p role="status">{message}</p>}
 </section>;
}
