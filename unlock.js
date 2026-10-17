const form=document.querySelector('#access-form');
const input=document.querySelector('#access-code');
const submit=document.querySelector('#access-submit');
const error=document.querySelector('#access-error');
const decoder=new TextDecoder();
const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const blob=(text,type)=>URL.createObjectURL(new Blob([text],{type}));
let envelopePromise;

function loadEnvelope(){
  if(!envelopePromise)envelopePromise=fetch('payload.json',{cache:'no-cache'}).then(response=>{
    if(!response.ok)throw new Error('network');return response.json();
  }).catch(cause=>{envelopePromise=undefined;throw cause;});
  return envelopePromise;
}

form.addEventListener('submit',async event=>{
  event.preventDefault();
  error.textContent='';submit.disabled=true;submit.textContent='Открываем…';
  let envelope;
  try{
    if(!crypto.subtle)throw new Error('crypto');
    envelope=await loadEnvelope();
  }catch{
    error.textContent='Не удалось загрузить демонстрацию. Проверьте соединение и откройте ссылку HTTPS.';
    submit.disabled=false;submit.textContent='Войти';return;
  }
  let payload;
  try{
    const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(input.value),'PBKDF2',false,['deriveKey']);
    const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:bytes(envelope.salt),iterations:envelope.iterations,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['decrypt']);
    const clear=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(envelope.iv),tagLength:128},key,bytes(envelope.ciphertext));
    payload=JSON.parse(decoder.decode(clear));
  }catch{
    error.textContent='Код не подошёл. Проверьте его и попробуйте ещё раз.';
    submit.disabled=false;submit.textContent='Войти';input.focus();return;
  }
  try{
    const files=payload.files;
    const dataURL=blob(files['data.js'],'text/javascript');
    const modelURL=blob(files['model.js'],'text/javascript');
    const appCode=files['app.js'].replace("'./data.js'",JSON.stringify(dataURL)).replace("'./model.js'",JSON.stringify(modelURL));
    const appURL=blob(appCode,'text/javascript');
    const cssURL=blob(files['styles.css'],'text/css');
    const iconURL=blob(files['icon.svg'],'image/svg+xml');
    const documentCopy=new DOMParser().parseFromString(files['index.html'],'text/html');
    documentCopy.querySelector('link[rel=stylesheet]').href=cssURL;
    documentCopy.querySelector('link[rel=icon]').href=iconURL;
    documentCopy.querySelectorAll('script').forEach(node=>node.remove());
    const noindex=documentCopy.createElement('meta');noindex.name='robots';noindex.content='noindex,nofollow,noarchive';documentCopy.head.append(noindex);
    input.value='';
    document.head.innerHTML=documentCopy.head.innerHTML;
    document.body.innerHTML=documentCopy.body.innerHTML;
    const module=document.createElement('script');module.type='module';module.src=appURL;document.body.append(module);
    window.addEventListener('pagehide',()=>[dataURL,modelURL,appURL,cssURL,iconURL].forEach(URL.revokeObjectURL),{once:true});
  }catch{
    error.textContent='Не удалось открыть версию демонстрации. Сообщите владельцу ссылки.';
    submit.disabled=false;submit.textContent='Войти';
  }
});
