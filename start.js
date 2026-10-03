import {discoverLocalStudioBaseUrl} from './local-studio.js';
const status=document.querySelector('#status'),setup=document.querySelector('#setup'),command=document.querySelector('#command');
const id=new URL(location.href).searchParams.get('launch');
let active=false;
async function openLocal(base){
 const key='launch:'+id;const payload=(await chrome.storage.local.get(key))[key];const url=new URL('/',base);
 if(payload?.prompt){url.searchParams.set('prompt',payload.prompt);url.searchParams.set('send',payload.send?'1':'0');url.searchParams.set('model',payload.model);url.searchParams.set('voice_id',payload.voiceId);url.searchParams.set('aspect_ratio',payload.aspectRatio);}
 await chrome.storage.local.remove(key);location.replace(url.href);
}
async function start(){if(active)return;active=true;setup.hidden=true;document.querySelector('#heading').textContent='Starting Manimate…';
 try{
  let base=await discoverLocalStudioBaseUrl();if(base){await openLocal(base);return;}
  let result;
  try{result=await chrome.runtime.sendNativeMessage('ai.manimate.launcher',{action:'start'});}catch{result={status:'missing'};}
  if(result.status==='ready'){
   for(let i=0;i<30;i++){base=await discoverLocalStudioBaseUrl();if(base){await openLocal(base);return;}await new Promise(r=>setTimeout(r,1000));}
  }
  document.querySelector('#heading').textContent='Start Manimate';
  status.textContent=result.status==='missing'?'Install Manimate once to start it from Chrome.':'Your local workspace needs a moment of setup.';
  command.textContent=result.status==='missing'?`curl -fsSL https://manimate.ai/install.sh | MANIMATE_CHROME_EXTENSION_ID=${chrome.runtime.id} bash`:'manimate';
  document.querySelector('#detail').textContent=result.message || 'Choose local rendering or connect Manim Cloud during setup.';
  setup.hidden=false;
 }catch{status.textContent='Could not connect. Reload this page to try again.';}finally{active=false;}
}
document.querySelector('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(command.textContent);document.querySelector('#copy').textContent='Copied';}catch{status.textContent='Select and copy the command manually.';}};
// Finish automatically when a terminal installation starts the local server.
setInterval(async()=>{if(!active&&!setup.hidden){const base=await discoverLocalStudioBaseUrl();if(base)await openLocal(base);}},3000);
start();
