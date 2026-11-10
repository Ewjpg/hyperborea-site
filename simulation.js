(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const root = $('simulationView');
  if (!root) return;
  const ui = Object.fromEntries(['simBack','simViewport','simTooltip','simTools','simHint','simStatus','simPlay','simReset','simSeek','simTime','simSpeed','simCamera','simUndo','simClear','simActions','simReactionList','simReactionPanel','simGoal','simModeLabel','simPlayerMenu','simPlayerName','simPlayerRole','simPlayerWeapon','simPlayerActions','simPlayerClose','simShotPanel','simShotOwner','simShotVariants','simShotHint'].map(id => [id.slice(3).toLowerCase(), $(id)]));
  const STORAGE_KEY = 'hyperborea_simulation_v1';
  for(const id of ['simPassPanel','simPassVariants','simPassNotice','simPassNoticeText','simPassNoticeClose','simPassGiveBall','simPassDemo','simPassRanges','simPassUseRange','simPassMeasure'])ui[id.slice(3).toLowerCase()]=$(id);
  const MAX_ACTIONS = 60;
  const TYPES = new Set(['pass','curve','run','shot','zone','possession']);
  const TOOLS = new Set(['select','camera','pass','curve','run','shot','zone']);
  const LABELS = { pass: 'Пас', curve: 'Кручёный пас', run: 'Рывок', shot: 'Удар', zone: 'Зона давления', possession:'Мяч' };
  const VARIANTS = new Set(['straight','curve','lob','formless','formless-control']);
  const PASSES={low:'Низовой пас',lob:'Навес',through:'Пас вразрез',hidden:'Скрытый пас',curve:'Кручёный пас'};
  let passVariant='low',noticeOwner=null;
  let passRange='medium',pendingRange=null,pendingAim=null,passModel=null;
  const normalizePas=value=>(typeof value==='number'||typeof value==='string')&&String(value).trim()!==''&&Number.isFinite(Number(value))&&Number(value)>=0&&Number(value)<=99?Math.round(Number(value)):null;
  function readPas(player){const prefix={fearCard:'fear',wahCard:'wah',frogCard:'frog',swarggyCard:'swarggy',emilianoCard:'emiliano',yoruCard:'yoru'}[player?.id];const input=prefix?$(prefix+'StatPAS'):null;return input?normalizePas(input.value):normalizePas(player?.pas);}
  function passSummary(value){
    const base=value.distanceMeters.toFixed(1)+' м · '+(passModel?.PASS_RANGES[value.range]?.label||'Пас');
    if(value.pas===null)return base+' · PAS не задан — точность не рассчитана';
    return base+' · PAS '+value.pas+' · '+Math.round(value.successChance*100)+'%'+(value.accurate===false?' · отклонение '+value.errorMeters.toFixed(1)+' м':'');
  }
  function measurePass(target){
    if(!draft||tool!=='pass'||!passModel||!ui.passmeasure)return;
    const assessment=passModel.calculatePass({from:draft.from,to:draft.to||target,mode,pas:readPas(playerByKey(draft.owner)),variant:passVariant,seed:0});
    ui.passmeasure.hidden=false;ui.passmeasure.textContent=passSummary({...assessment,accurate:null});
  }
  const SHOTS = {straight:'Прямой',curve:'Кручёный',lob:'Навесной',formless:'Formless','formless-control':'Formless прыжок'};
  const HINTS = {
    select: 'Наведите на игрока, чтобы увидеть роль и оружие. Выберите инструмент для своей комбинации.',
    camera: 'Потяните поле, чтобы повернуть камеру. Колесо или жест двумя пальцами меняет масштаб.',
    pass: 'Пас: выберите начальную точку или игрока, затем точку приёма.',
    curve: 'Кручёный пас: начало → точка приёма → точка изгиба.',
    run: 'Рывок: сначала выберите игрока на поле, затем его цель.',
    shot: 'Удар: выберите начало, затем цель. Ворота находятся по центру коротких сторон.',
    zone: 'Зона давления: выберите центр, затем её край.'
  };
  const clamp = (number, min = 0, max = 100) => Math.max(min, Math.min(max, number));
  const point = value => value && Number.isFinite(value.x) && Number.isFinite(value.y)
    && value.x >= 0 && value.x <= 100 && value.y >= 0 && value.y <= 100 ? { x: value.x, y: value.y } : null;
  const copyPoint = value => ({ x: value.x, y: value.y });
  const safeText = (value, max = 160) => typeof value === 'string' ? value.trim().slice(0, max) : '';
  const duration = action => action.type === 'possession' ? 400 : action.type === 'zone' ? 1000 : action.type === 'run' ? 2800 : action.type==='pass'&&action.variant==='lob'?3000:action.type==='pass'&&action.variant==='through'?2200:action.type === 'shot' && action.variant?.startsWith('formless') ? 3000 : 2500;
  const state = { version: 1, modes: { '5': [], '11': [] } };
  let active = false, renderer = null, snapshot = null, mode = '5', actions = [], tool = 'select';
  let draft = null, hoverPoint = null, onBack = null, loading = false, epoch = 0, sequence = 0;
  let time = 0, playing = false, frame = 0, previewFrame = 0, lastFrame = 0, speed = 1, lastPose = null, activeActionIndex = -1;
  let resolveChemistry = () => [];
  let reactionRenderer = null, reactionPending = false;
  function syncReactionDepth() {
    const visible = active && !ui.reactionpanel?.hidden;
    reactionRenderer?.setActive(visible && !document.hidden);
    if (!visible || reactionRenderer || reactionPending) return;
    const ticket = epoch;
    reactionPending = true;
    // A failed decorative scene keeps the SVG reaction and the field usable.
    import('./reaction-renderer.js?v=32').then(scene => {
      if (!active || ticket !== epoch || ui.reactionpanel?.hidden) return;
      const host = $('simReactionDepth');
      if (!host) return;
      reactionRenderer = scene.createReactionRenderer(host);
      ui.reactionpanel.classList.add('has-depth');
      reactionRenderer.setActive(!document.hidden);
    }).catch(() => {}).finally(() => { if (ticket === epoch) reactionPending = false; });
  }
  let selectedPlayer=null, shotVariant='straight', menuPlayer=null, canonicalWeapon='';
  let actionPoint=null, actionHeight=null, formlessPose=null;
  const isFormless=variant=>variant==='formless'||variant==='formless-control';
  const draftCurved=()=>tool==='curve'||(tool==='pass'&&passVariant==='curve')||(tool==='shot'&&shotVariant==='curve');
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved?.version === 1 && saved.modes) {
      for (const key of ['5','11']) if (Array.isArray(saved.modes[key])) state.modes[key] = saved.modes[key].slice(0, MAX_ACTIONS);
    }
  } catch { /* Private browsing or a malformed save should not block the editor. */ }

  const tell = message => { if (ui.status) ui.status.textContent = message; };
  const total = () => actions.reduce((sum, action) => sum + duration(action), 0);
  const playerByKey = key => snapshot?.players.find(player => player.key === key);
  const playerLocation=player=>lastPose?.players.find(value=>value.key===player.key)||player;
  function save() {
    state.modes[mode] = actions.map(action => ({ ...action }));
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch { tell('План сохранён до закрытия страницы: браузер запретил постоянное сохранение.'); }
  }
  function validateActions(values) {
    if (!Array.isArray(values)) return [];
    return values.slice(0, MAX_ACTIONS).flatMap((value, index) => {
      if (!value || !TYPES.has(value.type)) return [];
      const from = point(value.from), to = point(value.to), control = point(value.control);
      const variant=value.type==='shot'?(VARIANTS.has(value.variant)?value.variant:'lob'):value.type==='pass'&&Object.hasOwn(PASSES,value.variant)?value.variant:null;
      if (!from || !to || ((value.type === 'curve' || variant==='curve') && !control)) return [];
      const action = { mode,id: `saved-${index}-${++sequence}`, type: value.type, from, to };
      if (control) action.control = control;
      if (variant) action.variant=variant;
      if (value.type === 'run' || value.type==='shot'||value.type==='possession'||value.type==='pass'||value.type==='curve') {
        const owner = playerByKey(value.owner);
        if((value.type==='run'||value.type==='possession')&&!owner)return [];
        if(value.owner&&(!owner||(value.ownerId&&value.ownerId!==owner.id)))return [];
        if(isFormless(variant)&&owner?.id!=='fearCard')return [];
        if(owner){action.owner = owner.key;action.ownerId = owner.id;}
      }
      const receiver=playerByKey(value.receiver);
      if(receiver&&(!value.receiverId||value.receiverId===receiver.id)){action.receiver=receiver.key;action.receiverId=receiver.id;}
      if(value.type==='pass'&&(variant==='through'||variant==='hidden')){
        const owner=playerByKey(action.owner);
        if(!action.receiver||!owner||receiver.team!==owner.team)return [];
        if(variant==='through'){const start=point(value.receiverFrom);if(!start)return [];action.receiverFrom=start;}
      }
      if(value.type==='pass'&&value.assessment){
        const target=point(value.target);
        if(!target||!Number.isInteger(value.seed)||value.seed<0||value.seed>4294967295)return [];
        action.mode=mode;action.target=target;action.seed=value.seed;
        action.assessment=passModel.calculatePass({from,to:target,mode,pas:normalizePas(value.assessment.pas),variant:variant||'low',seed:value.seed});
        action.to=copyPoint(action.assessment.actualTo);action.range=action.assessment.range;
      }
      return [action];
    });
  }
  function cleanSnapshot(value) {
    if (!value || !['5','11'].includes(String(value.mode)) || !Array.isArray(value.players)) throw new Error('invalid-snapshot');
    const seen = new Set();
    const players = value.players.slice(0, 22).flatMap(player => {
      const position = point(player), key = safeText(player?.key, 80);
      if (!position || !key || seen.has(key)) return [];
      seen.add(key);
      return [{ ...position, key, id: safeText(player.id, 80), name: safeText(player.name, 60) || 'Игрок',
        role: safeText(player.role, 40),pas:normalizePas(player.pas), weapon: player.id==='fearCard'&&canonicalWeapon?canonicalWeapon:safeText(player.weapon, 600), image: safeText(player.image, 1000),
        team: player.team === 'b' ? 'b' : 'a' }];
    });
    if (!players.length) throw new Error('empty-snapshot');
    return { mode: String(value.mode), selectedTeam: value.selectedTeam === 'b' ? 'b' : 'a', players };
  }
  function displayHint() {
    if (!ui.hint) return;
    if (!draft) ui.hint.textContent = HINTS[tool];
    else if (draftCurved() && draft.to) ui.hint.textContent = 'Теперь выберите точку изгиба. Escape — отменить линию.';
    else ui.hint.textContent = `${tool === 'zone' ? 'Выберите край зоны.' : 'Выберите конечную точку.'} Escape — отменить.`;
    if(ui.shothint)ui.shothint.textContent='';
  }
  function cancelDraft() {
    hidePassNotice();
    cancelAnimationFrame(previewFrame);
    previewFrame = 0;
    draft = null;
    hoverPoint = null;
    displayHint();
    updateAnnotations();
  }
  function updateAnnotations() {
    if (!renderer) return;
    let preview = null;
    if (draft && hoverPoint) {
      measurePass(hoverPoint);
      preview = { id: 'draft', type: tool, from: draft.from, to: draft.to || hoverPoint, preview: true };
        if(tool==='shot'||tool==='pass'){preview.variant=tool==='shot'?shotVariant:passVariant;if(draft.owner){preview.owner=draft.owner;preview.ownerId=playerByKey(draft.owner)?.id;}}
      if (draftCurved()) preview.control = draft.to ? hoverPoint : { x: (draft.from.x + hoverPoint.x) / 2, y: (draft.from.y + hoverPoint.y) / 2 };
    }
    renderer.setAnnotations(preview ? [...actions, preview] : actions);
  }
  function closeMenu(){menuPlayer=null;if(ui.playermenu)ui.playermenu.hidden=true;}
  function showMenu(player,event){
    if(!ui.playermenu)return;
    menuPlayer=player.key;selectedPlayer=player.key;
    if(ui.playername)ui.playername.textContent=player.name;
    if(ui.playerrole)ui.playerrole.textContent='РОЛЬ / '+(player.role||'не указана');
    if(ui.playerweapon)ui.playerweapon.textContent=player.id==='fearCard'?'Formless':(player.weapon||'Оружие пока не указано').split('\n')[0].slice(0,100);
    if(ui.tooltip)ui.tooltip.hidden=true;ui.playermenu.hidden=false;
    ui.playermenu.classList.toggle('is-shot-menu',tool==='shot');
    ui.playermenu.classList.toggle('is-pass-menu',tool==='pass');
    renderShotPanel();
    renderPassPanel();
    const ballButton=ui.playeractions?.querySelector('[data-player-action="possession"]');
    if(ballButton)ballButton.setAttribute('aria-pressed',String(lastPose?.carrier===player.key));
    const projected=renderer?.project({...playerLocation(player),height:2});
    const x=Number.isFinite(event?.clientX)?event.clientX:projected?.x||innerWidth/2;
    const y=Number.isFinite(event?.clientY)?event.clientY:projected?.y||innerHeight/2;
    ui.playermenu.style.left=clamp(x+14,8,Math.max(8,innerWidth-ui.playermenu.offsetWidth-8))+'px';
    ui.playermenu.style.top=clamp(y-30,8,Math.max(8,innerHeight-ui.playermenu.offsetHeight-8))+'px';
    ui.playermenu.setAttribute('aria-label','Действия игрока '+player.name);
    ui.playeractions?.querySelector('button')?.focus({preventScroll:true});
  }
  function renderPassPanel(){
    if(ui.passpanel)ui.passpanel.hidden=tool!=='pass';
    ui.passvariants?.querySelectorAll('[data-pass-variant]').forEach(button=>{const chosen=button.dataset.passVariant===passVariant;button.classList.toggle('is-active',chosen);button.setAttribute('aria-pressed',String(chosen));});
    ui.passranges?.querySelectorAll('[data-pass-range]').forEach(button=>{const chosen=button.dataset.passRange===passRange;button.classList.toggle('is-active',chosen);button.setAttribute('aria-pressed',String(chosen));});
  }
  function hidePassNotice(){noticeOwner=null;pendingRange=null;pendingAim=null;if(ui.passnotice)ui.passnotice.hidden=true;}
  function notifyPass(text,demo,owner=null){
    tell(text);noticeOwner=owner;
    if(ui.passnotice){ui.passnotice.hidden=false;ui.passnotice.dataset.demo=demo;}
    if(ui.passnoticetext)ui.passnoticetext.textContent=text;
    if(ui.passgiveball)ui.passgiveball.hidden=demo!=='possession';
    if(ui.passuserange)ui.passuserange.hidden=demo!=='distance';
  }
  function renderShotPanel(){
    if(ui.shotpanel)ui.shotpanel.hidden=tool!=='shot';if(!ui.shotowner)return;
    ui.shotowner.replaceChildren();const none=document.createElement('option');none.value='';none.textContent='СВОБОДНАЯ ТОЧКА';ui.shotowner.append(none);
    for(const player of snapshot?.players||[]){const option=document.createElement('option');option.value=player.key;option.textContent=player.name+' / '+player.role+' / '+player.team.toUpperCase();ui.shotowner.append(option);}
    const player=playerByKey(selectedPlayer);if(!player)selectedPlayer=null;ui.shotowner.value=selectedPlayer||'';
    if(isFormless(shotVariant)&&player?.id!=='fearCard')shotVariant='straight';
    ui.shotvariants?.querySelectorAll('[data-shot-variant]').forEach(button=>{
      const variant=button.dataset.shotVariant;button.hidden=isFormless(variant)&&player?.id!=='fearCard';const chosen=variant===shotVariant;button.classList.toggle('is-active',chosen);button.setAttribute('aria-pressed',String(chosen));
    });displayHint();
  }
  function prepareAppend(){
    pause();
    // New steps extend the completed scene without rewinding its players.
    if(time!==total()){time=total();updatePose();updateTransport();}
  }
  function beginFromPlayer(player){
    if(!player||!TYPES.has(tool)||tool==='zone')return;
    prepareAppend();draft={from:copyPoint(playerLocation(player)),owner:player.key};hoverPoint=null;displayHint();updateAnnotations();
  }
  function setTool(next,fromPlayer=null) {
    if (!TOOLS.has(next)) return;
    pause();
    hidePassNotice();
    closeMenu();
    tool = next;
    cancelDraft();
    renderer?.setTool(tool);
    ui.tools?.querySelectorAll('[data-sim-tool]').forEach(button => {
      const selected = button.dataset.simTool === tool;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    if (ui.tooltip) ui.tooltip.hidden = true;
    if(fromPlayer)selectedPlayer=fromPlayer.key;
    renderShotPanel();renderPassPanel();if(fromPlayer&&next!=='pass')beginFromPlayer(fromPlayer);
  }
  function addAction(action) {
    if (actions.length >= MAX_ACTIONS) { tell(`В одном плане может быть не больше ${MAX_ACTIONS} действий.`); cancelDraft(); return; }
    const start=total();
    actions.push({ mode,...action, id: `action-${Date.now()}-${++sequence}` });
    setTool('select');
    save();
    renderActions();
    time=start;updatePose();startPlayback(start);
    tell(`${LABELS[action.type]} добавлен. Постройте следующие действия или запустите репетицию.`);
  }
  function onPoint(position, event, ownerKey = null) {
    if (!active || loading || !renderer || !point(position)) return;
    if(tool==='select'){closeMenu();return;}if(tool==='camera')return;
    if(tool==='pass'&&!draft)return;
    if(!draft)prepareAppend();
    const currentPoint = copyPoint(position);
    if (!draft) {
      let owner = playerByKey(ownerKey);
      if(tool==='shot'&&!owner)owner=playerByKey(selectedPlayer);
      if (tool === 'run' && !owner) {
        owner = snapshot.players.reduce((nearest, player) => {
          const location=playerLocation(player),distance = Math.hypot(location.x - position.x, location.y - position.y);
          return distance < 8 && (!nearest || distance < nearest.distance) ? { player, distance } : nearest;
        }, null)?.player;
        if (!owner) { tell('Для рывка сначала нажмите на игрока.'); return; }
      }
      if(owner&&(tool==='run'||tool==='shot')){selectedPlayer=owner.key;renderShotPanel();}
      draft = { from: owner && (tool === 'run'||tool==='shot') ? copyPoint(playerLocation(owner)) : currentPoint, owner: owner?.key };
      if(tool==='shot'&&owner&&!ownerKey){finishPoint(currentPoint,event);return;}
      hoverPoint = null;
      displayHint();
      return;
    }
    finishPoint(currentPoint,event);
  }
  function finishPoint(currentPoint,event){
    if(!draft)return;
    if(tool==='pass'&&(passVariant==='through'||passVariant==='hidden')){
      const owner=playerByKey(draft.owner),receiver=snapshot.players.find(player=>player.key!==draft.owner&&player.team===owner?.team&&Math.hypot(playerLocation(player).x-currentPoint.x,playerLocation(player).y-currentPoint.y)<4);
      if(passVariant==='through'&&!draft.receiver){
        if(!receiver){notifyPass('Выбери партнёра, который побежит на передачу.','through');return;}
        draft.receiver=receiver.key;draft.receiverFrom=copyPoint(playerLocation(receiver));
        notifyPass('Теперь укажи точку перед партнёром по направлению атаки.','through');return;
      }
      if(passVariant==='through'){
        const direction=owner?.team==='a'?-1:1;
        if((currentPoint.y-draft.receiverFrom.y)*direction<3||Math.hypot(currentPoint.x-draft.receiverFrom.x,currentPoint.y-draft.receiverFrom.y)<4){notifyPass('Укажи точку дальше вперёд — партнёр должен сделать рывок.','through');return;}
      }else{
        const sideways=Math.abs(currentPoint.x-draft.from.x)>=8,backward=(currentPoint.y-draft.from.y)*(owner?.team==='a'?1:-1)>=3;
        if(!receiver||(!sideways&&!backward)){notifyPass('Для скрытого паса выбери партнёра сбоку или сзади.','hidden');return;}
      }
    }
    if (draftCurved() && !draft.to) {
      if (Math.hypot(currentPoint.x - draft.from.x, currentPoint.y - draft.from.y) < 1) { tell('Точка приёма должна отличаться от начала.'); return; }
      draft.to = currentPoint;
      hoverPoint = currentPoint;
      displayHint();
      updateAnnotations();
      return;
    }
    const end = draftCurved() ? draft.to : currentPoint;
    if (Math.hypot(end.x - draft.from.x, end.y - draft.from.y) < 1) { tell('Выберите точку чуть дальше от начала.'); return; }
    const action = { type: tool, from: draft.from, to: end };
    if (draftCurved()) action.control = currentPoint;
    if(tool==='shot')action.variant=shotVariant;
    if(tool==='pass')action.variant=passVariant;
    if (draft.owner) { action.owner = draft.owner; action.ownerId = playerByKey(draft.owner)?.id; }
    if(tool==='pass'||tool==='curve'){
      const receiver=snapshot.players.find(player=>player.key!==draft.owner&&Math.hypot(playerLocation(player).x-end.x,playerLocation(player).y-end.y)<4);
      if(receiver){action.receiver=receiver.key;action.receiverId=receiver.id;}
      if(tool==='pass'&&passVariant==='through'){action.receiver=draft.receiver;action.receiverId=playerByKey(draft.receiver)?.id;action.receiverFrom=draft.receiverFrom;}
    }
    if(tool==='pass'&&passModel){
      const metres=passModel.distanceMeters(action.from,end,mode),range=passModel.classifyDistance(metres);
      if(range!==passRange){
        notifyPass('До цели '+metres.toFixed(1)+' м. Выбери «'+passModel.PASS_RANGES[range].label+'».','distance');
        pendingRange=range;pendingAim=copyPoint(currentPoint);return;
      }
      const seed=crypto.getRandomValues(new Uint32Array(1))[0];
      action.seed=seed;action.target=copyPoint(end);action.range=range;
      action.assessment=passModel.calculatePass({from:action.from,to:end,mode,pas:readPas(playerByKey(action.owner)),variant:passVariant,seed});
      action.to=copyPoint(action.assessment.actualTo);
    }
    if(tool==='shot'&&isFormless(shotVariant)&&playerByKey(draft.owner)?.id!=='fearCard'){tell('Formless принадлежит FEAR.');return;}
    addAction(action);
    event?.preventDefault?.();
  }
  function onPlayer(key, event) {
    const player = playerByKey(typeof key === 'object' ? key?.key : key);
    if (!player || !active) return;
    if (!draft) {
      pause();setTool('select');showMenu(player,event);
      return;
    }
    if(!draft&&tool!=='camera')prepareAppend();
    if(tool==='shot'&&!draft){selectedPlayer=player.key;renderShotPanel();}
    onPoint(playerLocation(player), event, player.key);
  }
  function onHover(player, position) {
    if (!ui.tooltip || !active || !player || !position || tool === 'camera'||menuPlayer) { if (ui.tooltip) ui.tooltip.hidden = true; return; }
    const value = playerByKey(typeof player === 'string' ? player : player.key);
    if (!value) { ui.tooltip.hidden = true; return; }
    ui.tooltip.replaceChildren();
    const name = document.createElement('strong'), details = document.createElement('span'), weapon = document.createElement('span');
    name.textContent = value.name;
    details.textContent = `Роль: ${value.role || 'не указана'}`;
    weapon.textContent = `Оружие: ${value.id==='fearCard'?'Formless':value.weapon || 'пока не указано'}`;
    ui.tooltip.append(name, details, weapon);
    ui.tooltip.hidden = false;
    const width = ui.tooltip.offsetWidth || 230, height = ui.tooltip.offsetHeight || 90;
    ui.tooltip.style.left = `${clamp(position.x + 14, 8, Math.max(8, innerWidth - width - 8))}px`;
    ui.tooltip.style.top = `${clamp(position.y + 14, 8, Math.max(8, innerHeight - height - 8))}px`;
  }
  function renderActions() {
    if (!ui.actions) return;
    activeActionIndex = -1;
    ui.actions.replaceChildren();
    actions.forEach((action, index) => {
      const li = document.createElement('li'), name = document.createElement('span'), remove = document.createElement('button');
      li.className = 'sim-action';
      li.dataset.actionId = action.id;
      name.textContent = `${action.type==='shot'?'Удар / '+SHOTS[action.variant]:action.type==='pass'&&PASSES[action.variant]?PASSES[action.variant]:LABELS[action.type]}${action.owner ? ` — ${playerByKey(action.owner)?.name || 'Игрок'}` : ''}`;
      if(action.assessment){const detail=document.createElement('small');detail.className='sim-pass-assessment';detail.textContent=passSummary(action.assessment);name.append(detail);li.classList.toggle('is-missed',action.assessment.accurate===false);}
      remove.type = 'button';
      remove.className = 'sim-action-remove';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Удалить действие ${index + 1}: ${LABELS[action.type]}`);
      remove.dataset.removeAction = action.id;
      li.append(name, remove);
      ui.actions.append(li);
    });
    if (!actions.length) {
      const empty = document.createElement('li');
      empty.className = 'sim-actions-empty';
      empty.textContent = 'Нет действий';
      ui.actions.append(empty);
    }
    updateAnnotations();
    updateTransport();
  }
  function renderReactions() {
    if (!ui.reactionlist || !snapshot) return;
    ui.reactionlist.replaceChildren();
    const reactions = resolveChemistry(snapshot.players);
    if(ui.reactionpanel){ui.reactionpanel.hidden=!reactions.length;ui.reactionpanel.classList.toggle('is-active',reactions.length>0);}
    syncReactionDepth();
    if(!reactions.length)return;
    reactions.forEach(reaction => {
      const card = document.createElement('article'), title = document.createElement('h4');
      card.className = 'sim-reaction';
      title.textContent = reaction.title;
      card.append(title);
      if (reaction.team) { const team = document.createElement('small'); team.textContent = `Команда ${reaction.team.toUpperCase()}`; card.append(team); }
      ui.reactionlist.append(card);
    });
    const partners=$('simReactionPartners');
    if(partners){partners.replaceChildren();
      for(const [index,id] of ['fearCard','wahCard'].entries()){
        const player=snapshot.players.find(value=>value.id===id);if(!player)continue;
        if(index){const cross=document.createElement('i');cross.textContent='×';partners.append(cross);}
        const member=document.createElement('span'),img=document.createElement('img'),name=document.createElement('span');
        member.className='sim-reaction-member';img.src=player.image;img.alt=player.name;img.draggable=false;name.textContent=player.name;member.append(img,name);partners.append(member);
      }
    }
  }
  const interpolate = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  function positionOn(action, t) {
    if(actionPoint)return actionPoint(action,t);
    if (action.type !== 'curve'&&!(action.type==='shot'&&action.variant==='curve')) return interpolate(action.from, action.to, t);
    const u = 1 - t;
    return { x: u*u*action.from.x + 2*u*t*action.control.x + t*t*action.to.x,
      y: u*u*action.from.y + 2*u*t*action.control.y + t*t*action.to.y };
  }
  function isGoal(action) { return action.type === 'shot' && action.to.x >= 40 && action.to.x <= 60 && (action.to.y <= 4 || action.to.y >= 96); }
  function updatePose() {
    if (!renderer || !snapshot) return;
    const poses = new Map(snapshot.players.map(player => [player.key, { key: player.key, x: player.x, y: player.y,height:0,tilt:0,heading:0,effect:0 }]));
    let elapsed = 0, ball = null, goal = false, activeIndex = -1;
    let carrier=(snapshot.players.find(player=>player.id==='fearCard')||snapshot.players[0])?.key||null;
    const carry=()=>{const owner=poses.get(carrier);if(owner)ball={x:clamp(owner.x+1.5),y:clamp(owner.y-0.8),height:Math.max(0,owner.height||0)};};
    carry();
    for (let index = 0; index < actions.length; index++) {
      const action = actions[index], length = duration(action);
      if (time < elapsed) break;
      const progress = clamp((time - elapsed) / length, 0, 1);
      if(action.type==='possession'){
        carrier=poses.has(action.owner)?action.owner:carrier;carry();
      } else if (action.type === 'run' && poses.has(action.owner)) {
        const location = positionOn(action, progress);
        poses.set(action.owner, { key: action.owner, ...location,height:0,tilt:0,heading:0,effect:0 });
        carry();
      } else if (action.type !== 'zone') {
        carrier=null;
        if(action.type==='pass'&&action.variant==='through'&&poses.has(action.receiver))poses.set(action.receiver,{key:action.receiver,...interpolate(action.receiverFrom,action.target||action.to,progress),height:0,tilt:0,heading:0,effect:0});
        if(action.type==='pass'&&action.variant==='hidden'&&poses.has(action.owner)){
          const owner=poses.get(action.owner);poses.set(action.owner,{...owner,heading:progress<.28?Math.sin(progress/.28*Math.PI)*1.1:0});
        }
        const location = positionOn(action, progress);
        const height = actionHeight?actionHeight(action,progress):Math.sin(Math.PI*progress)*(action.type==='curve'?3.5:action.type==='shot'?5:1.8);
        ball = { ...location, height };
        if(action.type==='shot'&&isFormless(action.variant)&&poses.has(action.owner)&&formlessPose)poses.set(action.owner,{key:action.owner,...formlessPose(action,progress)});
        if(progress===1&&(action.type==='pass'||action.type==='curve')&&action.assessment?.accurate!==false){
          const receiver=poses.get(action.receiver)||[...poses.values()].find(player=>Math.hypot(player.x-action.to.x,player.y-action.to.y)<4);
          if(receiver){carrier=receiver.key;carry();}
        }
      }
      if (progress < 1) { activeIndex = index; goal = isGoal(action) && progress > 0.95; break; }
      goal = isGoal(action);
      elapsed += length;
    }
    lastPose = { players: [...poses.values()], ball, carrier };
    if(ui.passmeasure&&!draft){const entry=(activeIndex>=0?actions[activeIndex]:[...actions].reverse().find(action=>action.assessment));if(entry?.assessment){ui.passmeasure.hidden=false;ui.passmeasure.textContent=passSummary(entry.assessment);}else ui.passmeasure.hidden=true;}
    renderer.setPose(lastPose);
    if (ui.goal) ui.goal.hidden = !goal;
    if (activeActionIndex !== activeIndex) {
      ui.actions?.querySelectorAll('.sim-action').forEach((li, index) => li.classList.toggle('is-active', index === activeIndex));
      activeActionIndex = activeIndex;
    }
  }
  function formatTime(ms) { const seconds = Math.floor(ms / 1000); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }
  function updateTransport() {
    const length = total(), available = !!renderer && !loading && actions.length > 0;
    if (ui.play) { ui.play.disabled = !available; ui.play.textContent = playing ? 'ПАУЗА' : 'ВОСПРОИЗВЕСТИ'; ui.play.setAttribute('aria-pressed', String(playing)); }
    if (ui.reset) ui.reset.disabled = !available;
    if (ui.seek) { ui.seek.disabled = !available; ui.seek.value = String(length ? time / length * 100 : 0); ui.seek.setAttribute('aria-valuetext', `${formatTime(time)} из ${formatTime(length)}`); }
    if (ui.time) ui.time.textContent = `${formatTime(time)} / ${formatTime(length)}`;
    if (ui.undo) ui.undo.disabled = !actions.length || loading;
    if (ui.clear) ui.clear.disabled = !actions.length || loading;
  }
  function pause() {
    playing = false;
    cancelAnimationFrame(frame);
    frame = 0;
    lastFrame = 0;
    updateTransport();
  }
  function tick(now) {
    if (!active || !playing || document.hidden) { pause(); return; }
    if (lastFrame) time = Math.min(total(), time + Math.min(100, now - lastFrame) * speed);
    lastFrame = now;
    updatePose();
    updateTransport();
    if (time >= total()) { pause(); tell('Репетиция завершена. Можно повторить или изменить план.'); return; }
    frame = requestAnimationFrame(tick);
  }
  function play() {
    if (!active || loading || !renderer || !actions.length || document.hidden) return;
    if (playing) { pause(); return; }
    cancelDraft();
    if (time >= total()) time = 0;
    startPlayback(time);
  }
  function startPlayback(at=time){
    if(!active||loading||!renderer||!actions.length||document.hidden)return;
    time=clamp(at,0,total());
    playing = true;
    lastFrame = 0;
    closeMenu();
    if (ui.tooltip) ui.tooltip.hidden = true;
    updatePose();updateTransport();
    tell('Идёт репетиция нарисованной комбинации.');
    frame = requestAnimationFrame(tick);
  }
  function removeAction(id) {
    pause();
    cancelDraft();
    closeMenu();
    actions = actions.filter(action => action.id !== id);
    time=total();
    save();
    renderActions();
    updatePose();
    updateTransport();
  }
  function reset() {
    pause();
    time = 0;
    cancelDraft();
    closeMenu();
    renderer?.resetPose();
    updatePose();
    updateTransport();
    tell('Игроки и мяч возвращены к началу комбинации.');
  }
  function close() {
    epoch++;
    active = false;
    loading = false;
    pause();
    cancelAnimationFrame(previewFrame);
    previewFrame = 0;
    draft = null;
    hoverPoint = null;
    closeMenu();selectedPlayer=null;
    hidePassNotice();
    if (ui.tooltip) ui.tooltip.hidden = true;
    if (ui.goal) ui.goal.hidden = true;
    if(ui.shotpanel)ui.shotpanel.hidden=true;
    if(ui.passpanel)ui.passpanel.hidden=true;
    if(ui.reactionpanel)ui.reactionpanel.hidden=true;
    reactionRenderer?.dispose();
    reactionRenderer = null;
    reactionPending = false;
    ui.reactionpanel?.classList.remove('has-depth');
    renderer?.setActive(false);
    renderer?.dispose();
    renderer = null;
    root.removeAttribute('aria-busy');
  }
  async function open(value, options = {}) {
    close();
    const ticket = epoch;
    active = true;
    loading = true;
    onBack = typeof options.onBack === 'function' ? options.onBack : null;
    root.hidden = false;
    root.setAttribute('aria-busy', 'true');
    tell('Подготавливаем 3D-поле…');
    ui.viewport?.querySelectorAll('.sim-render-error').forEach(node => node.remove());
    try {
      const [scene, chemistry, weapons, model] = await Promise.all([import('./sim-renderer.js?v=32'), import('./chemistry-rules.js?v=29'),import('./weapon-data.mjs?v=28'),import('./pass-model.js?v=31')]);
      if (!active || ticket !== epoch) return false;
      canonicalWeapon=weapons.FEAR_WEAPON;actionPoint=scene.getActionPoint||null;actionHeight=scene.getActionHeight||null;formlessPose=scene.getFormlessPose||null;
      passModel=model;
      resolveChemistry = chemistry.resolveChemistry;
      snapshot = cleanSnapshot(value);
      mode = snapshot.mode;
      root.dataset.mode=mode;
      actions = validateActions(state.modes[mode]);
      time = 0;
      shotVariant='straight';selectedPlayer=null;
      speed = [0.5,1,1.5,2].includes(Number(ui.speed?.value)) ? Number(ui.speed.value) : 1;
      if (ui.modelabel) {const size=passModel.getFieldSpec(mode);ui.modelabel.textContent = `${mode} × ${mode} / ${size.width} × ${size.length} М`;}
      renderer = new scene.FieldRenderer(ui.viewport, {
        mode,
        onPoint,
        onPlayer,
        onHover,
        onMove(position) {
          if (!active || !draft || !point(position)) return;
          hoverPoint = copyPoint(position);
          if (!previewFrame) previewFrame = requestAnimationFrame(() => { previewFrame = 0; if (active && draft) updateAnnotations(); });
        }
      });
      renderer.setPlayers(snapshot.players);
      renderer.setCamera(['broadcast','top','side'].includes(ui.camera?.value) ? ui.camera.value : 'broadcast');
      renderer.setActive(!document.hidden);
      renderer.resize();
      loading = false;
      setTool('select');
      renderActions();
      renderReactions();
      updatePose();
      save();
      if (!ui.viewport.hasAttribute('tabindex')) ui.viewport.tabIndex = 0;
      ui.viewport.focus({ preventScroll: true });
      tell('Постройте комбинацию и запустите репетицию. Действия сохраняются для этого формата поля.');
      return true;
    } catch (error) {
      if (!active || ticket !== epoch) return false;
      loading = false;
      renderer?.dispose();
      renderer = null;
      ui.viewport?.querySelectorAll('canvas').forEach(canvas => canvas.remove());
      const message = document.createElement('p');
      message.className = 'sim-render-error';
      message.textContent = '3D-поле не удалось открыть в этом браузере. Вернитесь к составу или попробуйте браузер с поддержкой WebGL.';
      ui.viewport?.append(message);
      tell('3D недоступно. Кнопка «К составу» вернёт вас на обычное поле.');
      updateTransport();
      return false;
    } finally {
      if (ticket === epoch) root.removeAttribute('aria-busy');
    }
  }

  ui.back?.addEventListener('click', () => { const callback = onBack; close(); callback?.(); });
  ui.tools?.addEventListener('click', event => { const button = event.target.closest('[data-sim-tool]'); if (active && button) setTool(button.dataset.simTool); });
  ui.playerclose?.addEventListener('click',()=>{setTool('select');ui.viewport?.focus({preventScroll:true});});
  ui.playeractions?.addEventListener('click',event=>{
    const button=event.target.closest('[data-player-action]'),player=playerByKey(menuPlayer);if(!active||!button||!player)return;
    const next=button.dataset.playerAction;
    if(next==='possession'){prepareAppend();const location=copyPoint(playerLocation(player));setTool('select');addAction({type:'possession',owner:player.key,ownerId:player.id,from:location,to:location});return;}
    setTool(next,player);
    if(next==='shot'||next==='pass')showMenu(player,event);
    if(next==='zone'){prepareAppend();draft={from:copyPoint(playerLocation(player)),owner:player.key};displayHint();}
  });
  ui.passvariants?.addEventListener('click',event=>{
    const button=event.target.closest('[data-pass-variant]'),player=playerByKey(selectedPlayer);if(!active||!button||!player||!Object.hasOwn(PASSES,button.dataset.passVariant))return;
    passVariant=button.dataset.passVariant;prepareAppend();cancelDraft();renderPassPanel();closeMenu();
    if(lastPose?.carrier!==player.key){notifyPass('Сначала дай мяч этому игроку.','possession',player.key);return;}
    beginFromPlayer(player);
    if(passVariant==='through')notifyPass('Выбери партнёра, который побежит на передачу.','through');
    if(passVariant==='hidden')notifyPass('Выбери партнёра сбоку или сзади.','hidden');
    ui.viewport?.focus({preventScroll:true});
  });
  ui.passranges?.addEventListener('click',event=>{const button=event.target.closest('[data-pass-range]');if(!button||!passModel?.PASS_RANGES[button.dataset.passRange])return;passRange=button.dataset.passRange;renderPassPanel();});
  ui.passuserange?.addEventListener('click',()=>{const range=pendingRange,aim=pendingAim;if(!range||!aim||!draft)return;passRange=range;hidePassNotice();renderPassPanel();finishPoint(aim);});
  ui.passnoticeclose?.addEventListener('click',hidePassNotice);
  ui.passgiveball?.addEventListener('click',()=>{const player=playerByKey(noticeOwner);if(!player)return;prepareAppend();const location=copyPoint(playerLocation(player));hidePassNotice();addAction({type:'possession',owner:player.key,ownerId:player.id,from:location,to:location});});
  ui.shotowner?.addEventListener('change',()=>{selectedPlayer=ui.shotowner.value||null;prepareAppend();cancelDraft();renderShotPanel();const player=playerByKey(selectedPlayer);if(player)beginFromPlayer(player);});
  ui.shotvariants?.addEventListener('click',event=>{
    const button=event.target.closest('[data-shot-variant]');if(!active||!button||!VARIANTS.has(button.dataset.shotVariant))return;
    const variant=button.dataset.shotVariant;if(isFormless(variant)&&playerByKey(selectedPlayer)?.id!=='fearCard')return;
    shotVariant=variant;prepareAppend();cancelDraft();renderShotPanel();const player=playerByKey(selectedPlayer);if(player)beginFromPlayer(player);closeMenu();ui.viewport?.focus({preventScroll:true});
  });
  ui.play?.addEventListener('click', play);
  ui.reset?.addEventListener('click', reset);
  ui.seek?.addEventListener('input', () => {
    const progress = clamp(Number(ui.seek.value) || 0) / 100;
    pause();
    cancelDraft();
    closeMenu();
    time = total() * progress;
    updatePose();
    updateTransport();
  });
  ui.speed?.addEventListener('change', () => { speed = [0.5,1,1.5,2].includes(Number(ui.speed.value)) ? Number(ui.speed.value) : 1; });
  ui.camera?.addEventListener('change', () => { renderer?.setCamera(ui.camera.value); });
  ui.undo?.addEventListener('click', () => { if (actions.length) removeAction(actions[actions.length - 1].id); });
  ui.clear?.addEventListener('click', () => { pause();cancelDraft();closeMenu(); actions = [];time=0; save(); renderActions(); updatePose();updateTransport(); tell('План очищен. Состав сохранён.'); });
  ui.actions?.addEventListener('click', event => { const button = event.target.closest('[data-remove-action]'); if (button) removeAction(button.dataset.removeAction); });
  document.addEventListener('pointerdown',event=>{if(menuPlayer&&!event.target.closest('#simPlayerMenu')&&!event.target.closest('#simViewport'))closeMenu();});
  window.addEventListener('resize',closeMenu,{passive:true});
  $('database')?.addEventListener('scroll',closeMenu,{passive:true});
  document.addEventListener('visibilitychange', () => { if (!active) return; if (document.hidden) { pause(); cancelDraft();closeMenu(); } renderer?.setActive(!document.hidden); syncReactionDepth(); });
  window.addEventListener('pagehide', () => { if (active) { pause(); cancelDraft();closeMenu(); renderer?.setActive(false); reactionRenderer?.setActive(false); } });
  window.addEventListener('pageshow', () => { if (active) { renderer?.setActive(!document.hidden); syncReactionDepth(); } });
  document.addEventListener('keydown', event => {
    if (!active || event.target.matches('input,textarea,select,[contenteditable="true"]')) return;
    if (event.key === 'Escape' && (draft||menuPlayer||(ui.passnotice&&!ui.passnotice.hidden))) { event.preventDefault(); event.stopImmediatePropagation();if(menuPlayer)closeMenu();else cancelDraft();hidePassNotice(); tell('Незавершённая линия отменена.'); }
    else if (event.code === 'Space' && (event.target === document.body || event.target === ui.viewport)) { event.preventDefault(); play(); }
    else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (actions.length) removeAction(actions[actions.length - 1].id); }
  }, true);
  window.Simulation = {
    open,
    close,
    back() { if (!active) return false;if(menuPlayer){closeMenu();return true;} if (draft) { cancelDraft(); return true; } const callback = onBack; close(); callback?.(); return true; },
    // Copies make inspection/export safe: callers cannot mutate the editor state.
    getState() { return JSON.parse(JSON.stringify({ active, loading, mode, actions, tool, draft, time, duration: total(), playing, speed,shotVariant,passVariant,selectedPlayer,menuPlayer, pose: lastPose, players: snapshot?.players || [], framePending: !!(frame || previewFrame) })); },
    project(position) { return renderer?.project?.(position) || null; },
    // For the AI match and the weather (sim-match.js): the live 3D field and the lineup it was opened with.
    get renderer() { return renderer; },
    get lineup() { return snapshot ? JSON.parse(JSON.stringify(snapshot)) : null; }
  };
})();
