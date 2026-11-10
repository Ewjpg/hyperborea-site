(() => {
 'use strict';
 const form=document.getElementById('fearSubmissionForm');
 const button=document.getElementById('fearSubmit');
 const status=document.getElementById('fearSubmitStatus');
 const sender=document.getElementById('fearSender');
 const pendingKey='hyperborea_fear_pending_v1',senderKey='hyperborea_fear_sender_v1';
 let busy=false,lastDelivered='',retry=false,pending=null;
 try{sender.value=localStorage.getItem(senderKey)||'';pending=JSON.parse(localStorage.getItem(pendingKey)||'null')}catch{}
 function snapshot(){return {nickname:sender.value.trim(),ratings:['PAC','SHO','PAS','DRI','DEF','PHY','OFN'].map(name=>{const value=document.getElementById('fearStat'+name).value;return value.trim()===''?null:Number(value)}),description:document.getElementById('fearDescription').value.trim(),weapon:document.getElementById('fearWeapon').value.trim()};}
 function message(text,state=''){status.textContent=text;status.dataset.state=state;}
 function sync(){const same=JSON.stringify(snapshot())===lastDelivered;button.disabled=busy||same;button.textContent=busy?'ОТПРАВКА…':same?'ОТПРАВЛЕНО JOSEPH':retry?'ПОВТОРИТЬ ОТПРАВКУ':'ОТПРАВИТЬ JOSEPH';}
 function persist(){try{localStorage.setItem(pendingKey,JSON.stringify(pending))}catch{}}
 function changed(){try{localStorage.setItem(senderKey,sender.value)}catch{}sync();}
 for(const field of document.querySelectorAll('.fear-ratings input,#fearDescription,#fearSender'))field.addEventListener('input',changed);
 async function request(path,options={}){
  const response=await fetch(path,{...options,cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(45000)});
  let data;try{data=await response.json()}catch{throw new Error('Не удалось получить ответ сервера. Повторите отправку.')}
  return {response,data};
 }
 async function token(){const {response,data}=await request('/api/fear/form');if(!response.ok)throw new Error(data.error||'Подключение временно недоступно.');return data.token;}
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;
  const payload=snapshot(),fingerprint=JSON.stringify(payload);
  if(!payload.description&&payload.ratings.every(value=>value===null)){message('Заполните оценки или характеристику FEAR. Formless уже закреплён в карточке.','error');return;}
  if(payload.ratings.some(value=>value!==null&&(!Number.isInteger(value)||value<0||value>99))){message('Оценки должны быть целыми числами от 0 до 99.','error');return;}
  if(!navigator.onLine){retry=true;message('Сейчас нет соединения. Черновик сохранён на устройстве; отправьте его после подключения.','error');sync();return;}
  if(!pending||pending.fingerprint!==fingerprint||typeof pending.id!=='string')pending={id:crypto.randomUUID(),fingerprint};
  persist();busy=true;retry=false;message('Сохраняем карточку и отправляем Joseph…');sync();
  try{
   let result;
   for(let attempt=0;attempt<2;attempt++){
    if(!pending.token)pending.token=await token();persist();
    result=await request('/api/fear/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:pending.id,token:pending.token,payload,website:form.elements.website.value})});
    if(result.data.refreshForm&&attempt===0){delete pending.token;continue}break;
   }
   if(result?.response.ok&&result.data.delivered){
    lastDelivered=fingerprint;message('Карточка сохранена и отправлена Joseph в Telegram. № '+result.data.id.slice(-8),'success');
    pending=null;try{localStorage.removeItem(pendingKey)}catch{}
   }else{retry=true;message(result?.data.error||'Не удалось подтвердить доставку. Повторите отправку.','error');}
  }catch(error){retry=true;message(error.name==='TimeoutError'?'Ответ задерживается. Повторите отправку — номер заявки останется прежним.':error.message==='Failed to fetch'?'Соединение прервалось. Повторите отправку; черновик сохранён.':error.message,'error');}
  finally{busy=false;sync();}
 });
 window.addEventListener('offline',()=>{if(!busy)message('Нет соединения. Черновик остаётся на этом устройстве.');});
 window.addEventListener('online',()=>{if(!busy&&!lastDelivered)message('Соединение восстановлено. Можно отправить карточку.');});
 sync();
})();
