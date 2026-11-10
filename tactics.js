(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const view=$('tacticsView');
  if(!view)return;
  const hub=$('tacticsHub'),workspace=$('tacticsWorkspace'),pitch=$('tacticsPitch');
  const slotsRoot=$('tacticsSlots'),bench=$('tacticsBench'),formationsRoot=$('tacticsFormations');
  const selectedOutput=$('tacticsSelected'),status=$('tacticsStatus'),database=$('database');
  const storageKey='hyperborea_tactics_v1',blank='blank';
  const formations={
    '5':['2-2','1-2-1','3-1','1-3'],
    '11':['4-3-3','4-4-2','4-2-3-1','3-5-2','3-4-3','5-3-2']
  };
  const catalog=new Map();
  document.querySelectorAll('#playersRoster button[id]').forEach(card=>{
    const image=card.querySelector('img'),name=card.querySelector('.fear-card-name,.wah-card-name,[data-player-name]');
    if(image&&name)catalog.set(card.id,{id:card.id,name:name.textContent.trim().slice(0,60),image:image.getAttribute('src')});
  });
  catalog.set(blank,{id:blank,name:'БОЛВАНКА',image:null});
  const clone=value=>JSON.parse(JSON.stringify(value));
  const clamp=(value,min=4,max=96)=>Math.max(min,Math.min(max,value));
  function layout(mode,formation,team){
    const rows=formation.split('-').map(Number),result=[{x:50,y:team==='a'?94:6,player:null}];
    rows.forEach((count,row)=>{
      const y=rows.length===1?70:83-row*25/(rows.length-1);
      for(let index=0;index<count;index++)result.push({x:count===1?50:12+index*76/(count-1),y:team==='a'?y:100-y,player:null});
    });
    return result.slice(0,Number(mode));
  }
  function initialMode(mode){
    const formation=formations[mode][0];
    return {selectedTeam:'a',teams:{a:{formation,slots:layout(mode,formation,'a')},b:{formation,slots:layout(mode,formation,'b')}}};
  }
  const state={version:1,modes:{'5':initialMode('5'),'11':initialMode('11')}};
  try{
    const saved=JSON.parse(localStorage.getItem(storageKey)||'null');
    if(saved&&saved.version===1&&saved.modes){
      for(const mode of ['5','11']){
        const incoming=saved.modes[mode];if(!incoming||!incoming.teams)continue;
        const modeState=state.modes[mode],seen=new Set();
        modeState.selectedTeam=incoming.selectedTeam==='b'?'b':'a';
        for(const team of ['a','b']){
          const candidate=incoming.teams[team];if(!candidate)continue;
          const formation=formations[mode].includes(candidate.formation)?candidate.formation:formations[mode][0];
          const defaults=layout(mode,formation,team);
          modeState.teams[team]={formation,slots:defaults.map((slot,index)=>{
            const value=Array.isArray(candidate.slots)?candidate.slots[index]:null;
            if(!value||typeof value!=='object')return slot;
            if(typeof value.x==='number'&&Number.isFinite(value.x))slot.x=clamp(value.x);
            if(typeof value.y==='number'&&Number.isFinite(value.y))slot.y=clamp(value.y);
            if(typeof value.player==='string'&&catalog.has(value.player)&&(value.player===blank||!seen.has(value.player))){slot.player=value.player;if(value.player!==blank)seen.add(value.player);}
            return slot;
          })};
        }
      }
    }
  }catch{}
  const history={'5':[],'11':[]};
  let active=false,mode='5',stage='hub',selection=null,pointer=null,ghost=null,scrollFrame=0,ignoreClickUntil=0;
  const current=()=>state.modes[mode];
  const teamName=team=>team==='a'?'A':'B';
  const tell=message=>{status.textContent=message;};
  function save(){
    try{localStorage.setItem(storageKey,JSON.stringify(state));}
    catch{tell('Состав доступен до закрытия страницы: браузер не разрешил сохранение.');}
  }
  function selectedSlot(){
    if(selection?.kind!=='slot')return null;
    return current().teams[selection.team].slots[selection.index]||null;
  }
  function findPlayer(id){
    if(id===blank)return null;
    for(const team of ['a','b']){
      const index=current().teams[team].slots.findIndex(slot=>slot.player===id);
      if(index>=0)return {team,index};
    }
    return null;
  }
  function playerFrom(source){
    if(source?.kind==='bench')return source.player;
    if(source?.kind==='slot')return current().teams[source.team].slots[source.index]?.player||null;
    return null;
  }
  function roleAt(team,index){
    if(index===0)return 'GK';
    const rows=current().teams[team].formation.split('-').map(Number);
    let offset=1;
    for(let row=0;row<rows.length;row++){
      if(index<offset+rows[row]){
        const count=rows[row],position=index-offset;
        const defense={1:['CB'],2:['LCB','RCB'],3:['LCB','CB','RCB'],4:['LB','LCB','RCB','RB'],5:['LWB','LCB','CB','RCB','RWB']};
        const attack={1:['CF'],2:['LW','RW'],3:['LW','CF','RW']};
        const middle={1:['CM'],2:['LCM','RCM'],3:['LCM','CM','RCM'],4:['LM','LCM','RCM','RM'],5:['LM','LCM','CDM','RCM','RM']};
        if(current().teams[team].formation==='4-2-3-1'&&row===1)return ['LCDM','RCDM'][position];
        if(current().teams[team].formation==='4-2-3-1'&&row===2)return ['LW','CAM','RW'][position];
        if(mode==='11'&&row===rows.length-1&&count===2)return ['LCF','RCF'][position];
        return (row===0?defense:row===rows.length-1?attack:middle)[count]?.[position]||'CM';
      }
      offset+=rows[row];
    }
    return 'POS';
  }
  function profile(id){
    const prefix={fearCard:'fear',wahCard:'wah',frogCard:'frog',swarggyCard:'swarggy',emilianoCard:'emiliano',yoruCard:'yoru'}[id];
    const raw=prefix?$(prefix+'StatPAS')?.value:'';
    const pas=typeof raw==='string'&&raw.trim()!==''&&Number.isFinite(Number(raw))&&Number(raw)>=0&&Number(raw)<=99?Math.round(Number(raw)):null;
    return {pas,weapon:(prefix?$(prefix+'Weapon')?.value:'')?.trim().slice(0,400)||'Оружие пока не указано',
      nativeRole:id==='fearCard'?'CF, LW':prefix?$(prefix+'Position')?.value?.trim()||'Роль пока не указана':'Свободная роль'};
  }
  function snapshot(){
    const players=[];
    for(const team of ['a','b'])current().teams[team].slots.forEach((slot,index)=>{
      if(slot.player)players.push({...catalog.get(slot.player),...profile(slot.player),key:team+':'+index,team,role:roleAt(team,index),x:slot.x,y:slot.y});
    });
    return {mode,selectedTeam:current().selectedTeam,players,teams:clone(current().teams)};
  }
  function ready(){return ['a','b'].some(team=>current().teams[team].slots.every(slot=>slot.player));}
  function hideTooltip(){const tip=$('tacticsTooltip');if(tip){tip.hidden=true;tip.replaceChildren();}}
  function showTooltip(element,x,y){
    const id=element?.dataset.player;if(!id||!catalog.has(id)||pointer?.dragging)return hideTooltip();
    const data=profile(id),tip=$('tacticsTooltip');if(!tip)return;
    const role=element.classList.contains('tactic-slot')?roleAt(element.dataset.team,Number(element.dataset.slot)):data.nativeRole;
    tip.replaceChildren();const name=document.createElement('strong'),line=document.createElement('span'),weapon=document.createElement('span');
    name.textContent=catalog.get(id).name;line.textContent='РОЛЬ / '+role;weapon.textContent='ОРУЖИЕ / '+data.weapon;tip.append(name,line,weapon);tip.hidden=false;
    tip.style.left=Math.max(8,Math.min(x+16,innerWidth-tip.offsetWidth-10))+'px';
    tip.style.top=Math.max(8,Math.min(y+18,innerHeight-tip.offsetHeight-10))+'px';
  }
  function returnToBoard(){window.Simulation?.close();stage='board';render();database.scrollTop=0;$('tacticsNext')?.focus({preventScroll:true});}
  async function openSimulation(){
    if(!ready()||stage!=='board')return;
    cancelDrag();selection=null;stage='simulation';render();database.scrollTop=0;
    if(window.Simulation)await window.Simulation.open(snapshot(),{onBack:returnToBoard});
    else{stage='board';render();tell('Поле не загрузилось. Обнови страницу и попробуй ещё раз.');}
  }
  function remember(){history[mode].push(clone(current()));if(history[mode].length>30)history[mode].shift();}
  function focusSlot(team,index){slotsRoot.querySelector(`[data-team="${team}"][data-slot="${index}"]`)?.focus({preventScroll:true});}
  function commit(change,message,focus=null){
    remember();change();save();render();if(message)tell(message);if(focus)focusSlot(focus.team,focus.index);
  }
  function tokenContent(element,id,benchToken=false){
    const player=catalog.get(id);if(!player)return;
    if(player.image){const image=document.createElement('img');image.src=player.image;image.alt='';image.draggable=false;image.className=benchToken?'tactic-bench-image':'tactic-token-image';element.appendChild(image);}
    else{
      const shape=document.createElement('span');shape.className=benchToken?'tactic-bench-blank':'tactic-token-blank';shape.setAttribute('aria-hidden','true');
      const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 40 44');svg.setAttribute('aria-hidden','true');
      const head=document.createElementNS(ns,'circle');head.setAttribute('cx','20');head.setAttribute('cy','9');head.setAttribute('r','6');head.setAttribute('fill','currentColor');
      const jersey=document.createElementNS(ns,'path');jersey.setAttribute('d','M14 18H26L35 24L30 32L26 29V42H14V29L10 32L5 24Z');jersey.setAttribute('fill','currentColor');
      svg.append(head,jersey);shape.appendChild(svg);element.appendChild(shape);
    }
    const name=document.createElement('span');name.className=benchToken?'tactic-bench-name':'tactic-token-name';name.textContent=player.name;element.appendChild(name);
  }
  function formationPreview(formation){
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
    svg.classList.add('tactic-formation-preview');svg.setAttribute('viewBox','0 0 80 54');svg.setAttribute('aria-hidden','true');
    const rows=formation.split('-').map(Number);
    const dot=(x,y)=>{const node=document.createElementNS(ns,'circle');node.setAttribute('cx',x);node.setAttribute('cy',y);node.setAttribute('r','2.2');svg.appendChild(node);};
    dot(40,48);rows.forEach((count,row)=>{for(let index=0;index<count;index++)dot(count===1?40:10+index*60/(count-1),36-row*28/Math.max(1,rows.length-1));});
    return svg;
  }
  function render(){
    view.dataset.mode=mode;view.dataset.stage=stage;
    hideTooltip();
    hub.hidden=stage!=='hub';workspace.hidden=stage!=='board';
    if($('simulationView'))$('simulationView').hidden=stage!=='simulation';
    $('tacticsNext').disabled=!ready();
    $('tacticsReadyHint').textContent=ready()?'Состав готов. Перенеси его на объёмное поле.':'Собери хотя бы один полный состав, чтобы продолжить.';
    pitch.dataset.mode=mode;pitch.dataset.team=current().selectedTeam;
    $('tacticsTitle').textContent=stage==='hub'?'TACTICS':mode+' × '+mode;
    $('tacticsModeLabel').textContent=mode+' × '+mode;
    view.querySelectorAll('[data-tactics-mode]').forEach(button=>{const chosen=button.dataset.tacticsMode===mode;button.classList.toggle('is-active',chosen);button.setAttribute('aria-pressed',String(chosen));});
    $('tacticsTeams').querySelectorAll('[data-tactics-team]').forEach(button=>{const chosen=button.dataset.tacticsTeam===current().selectedTeam;button.classList.toggle('is-active',chosen);button.setAttribute('aria-pressed',String(chosen));});
    formationsRoot.replaceChildren();
    for(const formation of formations[mode]){
      const button=document.createElement('button');button.type='button';button.className='tactic-formation';button.dataset.formation=formation;
      const chosen=current().teams[current().selectedTeam].formation===formation;button.classList.toggle('is-active',chosen);button.setAttribute('aria-pressed',String(chosen));
      button.setAttribute('aria-label','Схема '+formation+' для состава '+teamName(current().selectedTeam));
      button.appendChild(formationPreview(formation));const label=document.createElement('span');label.className='tactic-formation-name';label.textContent=formation;button.appendChild(label);formationsRoot.appendChild(button);
    }
    $('tacticsFormationLabel').textContent=current().teams[current().selectedTeam].formation;
    slotsRoot.replaceChildren();let count=0;
    for(const team of ['a','b'])current().teams[team].slots.forEach((slot,index)=>{
      const button=document.createElement('button');button.type='button';button.className='tactic-slot';button.dataset.team=team;button.dataset.slot=String(index);
      button.style.left=slot.x+'%';button.style.top=slot.y+'%';button.classList.toggle('is-target-team',team===current().selectedTeam);button.classList.toggle('is-other-team',team!==current().selectedTeam);
      const chosen=selection?.kind==='slot'&&selection.team===team&&selection.index===index;button.classList.toggle('is-selected',chosen);button.setAttribute('aria-pressed',String(chosen));
      const role=roleAt(team,index),label=slot.player?catalog.get(slot.player).name:'Свободная позиция';
      button.setAttribute('aria-label',label+', состав '+teamName(team)+', '+role+', позиция '+(index+1));
      if(slot.player){button.classList.add('is-filled');button.dataset.player=slot.player;tokenContent(button,slot.player);count++;}
      else{const number=document.createElement('span');number.className='tactic-slot-number';number.textContent=String(index+1).padStart(2,'0');button.appendChild(number);}
      const roleLabel=document.createElement('span');roleLabel.className='tactic-slot-role';roleLabel.textContent=role;button.appendChild(roleLabel);slotsRoot.appendChild(button);
    });
    bench.replaceChildren();
    for(const player of catalog.values()){
      const button=document.createElement('button');button.type='button';button.className='tactic-bench-player';button.dataset.player=player.id;
      const placed=findPlayer(player.id),chosen=selection?.kind==='bench'&&selection.player===player.id;
      button.classList.toggle('is-selected',chosen);button.classList.toggle('is-placed',Boolean(placed));button.setAttribute('aria-pressed',String(chosen));
      button.setAttribute('aria-label',player.name+(player.id===blank?', неограниченное количество':placed?', уже в составе '+teamName(placed.team)+', можно переместить':', поставить на поле'));
      tokenContent(button,player.id,true);
      const meta=document.createElement('span');meta.className='tactic-bench-meta';meta.textContent=player.id===blank?'∞ / БЕЗ ЛИМИТА':placed?'НА ПОЛЕ / '+teamName(placed.team):'ИЗ PLAYERS';button.appendChild(meta);
      const handle=document.createElement('span');handle.className='tactic-bench-drag-handle';handle.setAttribute('aria-hidden','true');handle.textContent='⠿';button.appendChild(handle);bench.appendChild(button);
    }
    const selectedPlayer=playerFrom(selection);
    selectedOutput.textContent=selectedPlayer?catalog.get(selectedPlayer).name+(selection.kind==='bench'?' / ВЫБРАН':' / СОСТАВ '+teamName(selection.team)):'ИГРОК НЕ ВЫБРАН';
    $('tacticsRemove').disabled=!(selection?.kind==='slot'&&selectedSlot()?.player);
    $('tacticsUndo').disabled=!history[mode].length;
    $('tacticsClear').disabled=!current().teams[current().selectedTeam].slots.some(slot=>slot.player);
    $('tacticsCount').textContent=count+' / '+(Number(mode)*2);
  }
  function showMode(value){
    if(!formations[value])return;
    cancelDrag();mode=value;stage='board';selection=null;render();save();tell('Выбери игрока снизу и позицию на поле.');database.scrollTop=0;$('tacticsTitle').focus({preventScroll:true});
  }
  function showHub(){cancelDrag();window.Simulation?.close();stage='hub';selection=null;render();$('tacticsHubTitle')?.focus({preventScroll:true});database.scrollTop=0;}
  function choosePlayer(id){
    if(!catalog.has(id))return;
    if(selection?.kind==='bench'&&selection.player===id)selection=null;
    else selection={kind:'bench',player:id};
    render();tell(selection?'Выбран '+catalog.get(id).name+'. Коснись позиции. Повторное нажатие снимает выбор.':'Выбор снят.');
    bench.querySelector(`[data-player="${id}"]`)?.focus({preventScroll:true});
  }
  function place(source,target,point=null){
    const id=playerFrom(source);if(!id)return false;
    const destination=current().teams[target.team]?.slots[target.index];if(!destination)return false;
    let origin=source.kind==='slot'?{team:source.team,index:source.index}:findPlayer(id);
    const same=origin&&origin.team===target.team&&origin.index===target.index;
    if(same&&!point){selection={kind:'slot',...target};current().selectedTeam=target.team;render();return false;}
    commit(()=>{
      if(origin&&!same){const previous=destination.player;current().teams[origin.team].slots[origin.index].player=previous;}
      destination.player=id;
      if(point){destination.x=point.x;destination.y=point.y;}
      current().selectedTeam=target.team;
      selection=source.kind==='bench'&&id===blank?{kind:'bench',player:blank}:{kind:'slot',...target};
    },catalog.get(id).name+' — состав '+teamName(target.team)+'.',target);
    return true;
  }
  function slotClick(team,index){
    if(selection&&playerFrom(selection)){place(selection,{team,index});return;}
    current().selectedTeam=team;
    if(current().teams[team].slots[index].player){selection={kind:'slot',team,index};render();focusSlot(team,index);tell('Игрок выбран. Перетащи его, выбери другую позицию или нажми «Убрать».');}
    else{selection=null;render();focusSlot(team,index);tell('Свободная позиция '+roleAt(team,index)+'. Сначала выбери игрока снизу.');}
    save();
  }
  function removeSelected(){
    if(selection?.kind!=='slot'||!selectedSlot()?.player)return;
    const target={team:selection.team,index:selection.index};
    commit(()=>{current().teams[target.team].slots[target.index].player=null;selection=null;},'Игрок возвращён в список.',target);
  }
  view.addEventListener('click',event=>{
    if(!active)return;
    const modeButton=event.target.closest('[data-tactics-mode]');if(modeButton){showMode(modeButton.dataset.tacticsMode);return;}
    const teamButton=event.target.closest('[data-tactics-team]');if(teamButton){cancelDrag();current().selectedTeam=teamButton.dataset.tacticsTeam==='b'?'b':'a';selection=null;save();render();return;}
    const formationButton=event.target.closest('[data-formation]');
    if(formationButton){
      const value=formationButton.dataset.formation;if(!formations[mode].includes(value))return;
      const team=current().selectedTeam;
      if(current().teams[team].formation===value)return;
      commit(()=>{const players=current().teams[team].slots.map(slot=>slot.player);current().teams[team]={formation:value,slots:layout(mode,value,team).map((slot,index)=>({...slot,player:players[index]||null}))};selection=null;},'Схема '+value+' применена. Игроки сохранены.');formationsRoot.querySelector(`[data-formation="${value}"]`)?.focus({preventScroll:true});return;
    }
    const benchButton=event.target.closest('.tactic-bench-player');
    if(benchButton){if(event.detail&&performance.now()<ignoreClickUntil)return;choosePlayer(benchButton.dataset.player);return;}
    const slot=event.target.closest('.tactic-slot');
    if(slot){if(event.detail&&performance.now()<ignoreClickUntil)return;slotClick(slot.dataset.team,Number(slot.dataset.slot));}
  });
  $('tacticsModes').addEventListener('click',showHub);
  $('tacticsNext').addEventListener('click',openSimulation);
  $('tacticsExit').addEventListener('click',()=>window.HyperboreaNavigation?.open('home'));
  $('tacticsRemove').addEventListener('click',removeSelected);
  $('tacticsResetPositions').addEventListener('click',()=>{
    const team=current().selectedTeam;
    commit(()=>{const lineup=current().teams[team],players=lineup.slots.map(slot=>slot.player);lineup.slots=layout(mode,lineup.formation,team).map((slot,index)=>({...slot,player:players[index]||null}));selection=null;},'Позиции восстановлены по схеме.');
  });
  $('tacticsClear').addEventListener('click',()=>{
    const team=current().selectedTeam;if(!current().teams[team].slots.some(slot=>slot.player))return;
    commit(()=>{current().teams[team].slots.forEach(slot=>{slot.player=null;});selection=null;},'Состав '+teamName(team)+' очищен. Можно отменить.');
  });
  $('tacticsUndo').addEventListener('click',()=>{
    const previous=history[mode].pop();if(!previous)return;
    cancelDrag();state.modes[mode]=previous;selection=null;save();render();tell('Последнее изменение отменено.');
  });
  view.addEventListener('keydown',event=>{
    if(!active||stage!=='board'||event.target.matches('input,textarea,select'))return;
    const button=event.target.closest('.tactic-slot');
    if(button&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
      const team=button.dataset.team,index=Number(button.dataset.slot),slot=current().teams[team].slots[index];if(!slot.player)return;
      event.preventDefault();const step=event.shiftKey?5:2,dx=event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0,dy=event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0;
      commit(()=>{slot.x=clamp(slot.x+dx);slot.y=clamp(slot.y+dy);selection={kind:'slot',team,index};current().selectedTeam=team;},'',{team,index});
    }else if((event.key==='Delete'||event.key==='Backspace')&&selection?.kind==='slot'){event.preventDefault();removeSelected();}
  });
  function sourceFrom(element){
    if(element.classList.contains('tactic-bench-player'))return {kind:'bench',player:element.dataset.player};
    if(element.classList.contains('tactic-slot')&&element.classList.contains('is-filled'))return {kind:'slot',team:element.dataset.team,index:Number(element.dataset.slot)};
    return null;
  }
  function cancelDrag(){
    hideTooltip();
    cancelAnimationFrame(scrollFrame);scrollFrame=0;
    if(pointer){try{if(pointer.element.hasPointerCapture(pointer.id))pointer.element.releasePointerCapture(pointer.id);}catch{}pointer.element.classList.remove('is-drag-source');}
    pointer=null;ghost?.remove();ghost=null;pitch.classList.remove('is-drag-over');document.body.classList.remove('tactic-dragging');
  }
  function autoScroll(){
    if(!pointer?.dragging)return;
    const header=database.querySelector('.db-header'),top=(header?.getBoundingClientRect().bottom||0)+40;
    const bottom=Math.min(innerHeight-20,bench.getBoundingClientRect().top-12);
    let speed=0;if(pointer.y<top+35)speed=-Math.min(12,(top+35-pointer.y)/5);
    else if(pointer.y>bottom-35&&pointer.y<innerHeight-12)speed=Math.min(12,(pointer.y-bottom+35)/5);
    if(speed)database.scrollTop+=speed;
    scrollFrame=requestAnimationFrame(autoScroll);
  }
  view.addEventListener('pointerdown',event=>{
    if(!active||stage!=='board'||event.button!==0)return;
    const element=event.target.closest('.tactic-bench-player,.tactic-slot');if(!element)return;
    const source=sourceFrom(element);if(!source)return;
    if(event.pointerType==='touch'&&source.kind==='bench'&&!event.target.closest('.tactic-bench-drag-handle'))return;
    cancelDrag();pointer={id:event.pointerId,element,source,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,lastX:event.clientX,dragging:false};
    try{element.setPointerCapture(event.pointerId);}catch{}
  });
  document.addEventListener('pointermove',event=>{
    if(!pointer||pointer.id!==event.pointerId)return;
    pointer.x=event.clientX;pointer.y=event.clientY;
    if(!pointer.dragging&&Math.hypot(pointer.x-pointer.startX,pointer.y-pointer.startY)>8){
      pointer.dragging=true;pointer.element.classList.add('is-drag-source');document.body.classList.add('tactic-dragging');
      ghost=document.createElement('div');ghost.className='tactic-drag-ghost';ghost.setAttribute('aria-hidden','true');
      ghost.style.position='fixed';ghost.style.left='0';ghost.style.top='0';ghost.style.pointerEvents='none';ghost.style.zIndex='1000';ghost.style.width='72px';ghost.style.height='84px';
      hideTooltip();const body=document.createElement('div');body.className='tactic-ghost-body';tokenContent(body,playerFrom(pointer.source));ghost.appendChild(body);document.body.appendChild(ghost);autoScroll();
    }
    if(pointer.dragging){
      event.preventDefault();ghost.style.transform=`translate3d(${pointer.x-36}px,${pointer.y-40}px,0)`;
      ghost.style.setProperty('--drag-tilt',Math.max(-8,Math.min(8,(pointer.x-pointer.lastX)*.6))+'deg');pointer.lastX=pointer.x;
      const bounds=pitch.getBoundingClientRect();pitch.classList.toggle('is-drag-over',pointer.x>=bounds.left&&pointer.x<=bounds.right&&pointer.y>=bounds.top&&pointer.y<=bounds.bottom);
    }
  },{passive:false});
  document.addEventListener('pointerup',event=>{
    if(!pointer||pointer.id!==event.pointerId)return;
    const drag=pointer;if(!drag.dragging){cancelDrag();return;}
    event.preventDefault();ignoreClickUntil=performance.now()+180;
    const bounds=pitch.getBoundingClientRect(),inside=event.clientX>=bounds.left&&event.clientX<=bounds.right&&event.clientY>=bounds.top&&event.clientY<=bounds.bottom;
    const targetElement=document.elementFromPoint(event.clientX,event.clientY)?.closest('.tactic-slot');
    const point={x:clamp((event.clientX-bounds.left)/bounds.width*100),y:clamp((event.clientY-bounds.top)/bounds.height*100)};
    cancelDrag();
    if(!inside){tell('Перенос отменён.');return;}
    let target=targetElement?{team:targetElement.dataset.team,index:Number(targetElement.dataset.slot)}:null;
    const same=target&&drag.source.kind==='slot'&&target.team===drag.source.team&&target.index===drag.source.index;
    if(target&&!same){place(drag.source,target);return;}
    if(drag.source.kind==='slot'){place(drag.source,{team:drag.source.team,index:drag.source.index},point);return;}
    const team=current().selectedTeam,existing=findPlayer(drag.source.player);
    const candidates=current().teams[team].slots.map((slot,index)=>({slot,index})).filter(item=>!item.slot.player);
    if(!candidates.length){
      if(existing&&existing.team===team){place(drag.source,existing,point);return;}
      tell('В составе нет свободной позиции. Перетащи игрока прямо на позицию для замены.');return;
    }
    candidates.sort((a,b)=>Math.hypot(a.slot.x-point.x,a.slot.y-point.y)-Math.hypot(b.slot.x-point.x,b.slot.y-point.y));
    place(drag.source,{team,index:candidates[0].index},point);
  });
  document.addEventListener('pointercancel',cancelDrag);
  view.addEventListener('pointermove',event=>{if(event.pointerType==='touch'||!active||stage!=='board')return;showTooltip(event.target.closest('.tactic-bench-player,.tactic-slot.is-filled'),event.clientX,event.clientY);},{passive:true});
  view.addEventListener('pointerleave',hideTooltip);
  view.addEventListener('focusin',event=>{if(!active||stage!=='board')return;const el=event.target.closest('.tactic-bench-player,.tactic-slot.is-filled');if(el){const r=el.getBoundingClientRect();showTooltip(el,r.left,r.bottom);}else hideTooltip();});
  view.addEventListener('focusout',hideTooltip);
  database.addEventListener('scroll',hideTooltip,{passive:true});
  window.addEventListener('resize',cancelDrag,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelDrag();});
  window.addEventListener('pagehide',()=>{cancelDrag();selection=null;});
  window.Tactics={
    setActive(value){cancelDrag();window.Simulation?.close();active=Boolean(value);selection=null;if(active){stage='hub';render();}else tell('');},
    back(){if(!active)return false;cancelDrag();if(stage==='simulation'){returnToBoard();return true;}if(selection){selection=null;render();tell('Выбор снят.');return true;}if(stage==='board'){showHub();return true;}return false;},
    cancelDrag,getSnapshot:snapshot
  };
  render();
})();
