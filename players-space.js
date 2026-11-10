(() => {
  'use strict';
  const roster = document.getElementById('playersRoster');
  const database = document.getElementById('database');
  const section = document.getElementById('dbSection');
  if (!roster || !database || !section) return;
  const cards = [...roster.querySelectorAll(':scope > button[id]')];
  if (!cards.length) return;
  roster.classList.toggle('space-expanded',cards.length>4);
  roster.classList.add('players-space');
  const backdrop = document.createElement('div');
  backdrop.className = 'space-backdrop'; backdrop.setAttribute('aria-hidden', 'true');
  roster.prepend(backdrop);
  const hud = document.createElement('span'); hud.className = 'space-hud';
  hud.textContent = String(cards.length).padStart(2, '0') + ' / PLAYERS';
  roster.append(hud);
  const shuffleButton = document.createElement('button');
  shuffleButton.type = 'button'; shuffleButton.className = 'space-shuffle';
  shuffleButton.setAttribute('aria-label', 'Перемешать расположение игроков');
  shuffleButton.title = 'Перемешать'; shuffleButton.textContent = '⤨';
  const controls=document.createElement('div');controls.className='space-controls';controls.setAttribute('role','group');controls.setAttribute('aria-label','Управление пространством');
  const control=(label,text,action)=>{const button=document.createElement('button');button.type='button';button.setAttribute('aria-label',label);button.title=label;button.textContent=text;button.addEventListener('click',action);controls.append(button);return button;};
  control('Отдалить','−',()=>zoomAt(view.zoom/1.2));
  const zoomLabel=document.createElement('output');zoomLabel.className='space-zoom';controls.append(zoomLabel);
  control('Приблизить','+',()=>zoomAt(view.zoom*1.2));
  control('Вернуть исходный вид','⌂',()=>resetView());controls.append(shuffleButton);roster.append(controls);
  roster.tabIndex=0;roster.setAttribute('aria-label','Пространство игроков: перетаскивание, масштаб колесом или двумя пальцами');
  const nodes = cards.map(card => {
    const wrapper = document.createElement('div'); wrapper.className = 'space-node';
    card.before(wrapper); wrapper.append(card);
    return { card, wrapper, position: null, projected: null, pose:null, lock:null, hovered:false, focused:false, slot: 0 };
  });
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = matchMedia('(pointer: coarse)');
  const center = { x: 0, y: 0 }, pointer = { x: 0, y: 0 };
  const view={panX:0,panY:0,zoom:1};
  const pointers=new Map();let gesture=null,suppressClick=false;
  let scene = null, pending = null, ticket = 0, frame = 0, lastFrame = 0;
  let active = false, directoryVisible = false, pageHidden = false, failed = false;
  let hovered = false, focused = false, entries = 0, seed = 0, time = 0, previous = 0;
  let layout = [], sceneLinks = [];
  const random = () => {
    // Separate from the intro's chance rolls; the graph is a visual layout only.
    const word = new Uint32Array(1);
    try { crypto.getRandomValues(word); return word[0] / 4294967296; }
    catch { return Math.random(); }
  };
  const shuffled = values => {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };
  const visible = () => database.classList.contains('active') && !roster.hidden && !section.hidden && !roster.classList.contains('space-suspended');
  const paused = () => motion.matches;
  function stop() { cancelAnimationFrame(frame); frame = 0; previous = 0; }

  function makeLayout() {
    seed = Math.floor(random() * 4294967296);
    const mobile = roster.clientWidth < 600;
    // Every roster member gets an anchor; identities are shuffled independently.
    let actual;
    if(nodes.length<=3)actual=(mobile ? [[.28,.31],[.72,.48],[.29,.76]] : [[.24,.34],[.74,.31],[.51,.76]]).slice(0,nodes.length);
    else if(nodes.length===4)actual=mobile ? [[.27,.23],[.73,.41],[.27,.63],[.73,.81]] : [[.24,.27],[.74,.27],[.26,.74],[.76,.74]];
    else {const columns=mobile?2:3,rows=Math.ceil(nodes.length/columns);actual=nodes.map((_,index)=>[mobile?(index%columns===0?.25:.75):(.18+(index%columns)*.32),mobile?(.21+Math.floor(index/columns)*.62/Math.max(1,rows-1)):(.28+Math.floor(index/columns)*.46/Math.max(1,rows-1))]);}
    const blanks = nodes.length>3?(mobile?[[.72,.08],[.2,.44],[.52,.91]]:[[.5,.12],[.5,.51],[.5,.9]]):(mobile ? [[.72,.16],[.19,.55],[.75,.82]] : [[.51,.13],[.17,.77],[.85,.71]]);
    const reflect = random() > .5;
    const swap = random() > .5 && !mobile;
    const anchors = actual.map(([x,y]) => [reflect ? 1-x : x, swap ? .99-y : y]);
    const identity = shuffled(nodes);
    const all = [...anchors.map((position,index) => ({position,node:identity[index]})),
      ...blanks.map(position => ({position:[reflect ? 1-position[0] : position[0], swap ? .99-position[1] : position[1]],node:null}))];
    layout = all.map(({position,node},index) => {
      const result = { u:position[0],v:position[1],z:(random()-.5)*1.1,
        phase:random()*Math.PI*2, angle:(random()-.5)*.1, size:node ? 1 : .4+random()*.1, node, index };
      if (node) { node.slot=index; node.position=result;node.lock=null;node.pose=null; }
      return result;
    });
    sceneLinks = createLinks(layout);
    if (scene) scene.setLayout(layout, sceneLinks);
  }
  function createLinks(values) {
    const edges=[];
    values.forEach((a,i)=>values.slice(i+1).forEach((b,j)=>edges.push({a:i,b:i+j+1,d:Math.hypot(a.u-b.u,a.v-b.v)})));
    edges.sort((a,b)=>a.d-b.d);
    const roots=values.map((_,i)=>i),root=i=>roots[i]===i?i:(roots[i]=root(roots[i]));
    const result=[];
    for(const edge of edges)if(root(edge.a)!==root(edge.b)){roots[root(edge.a)]=root(edge.b);result.push(edge);}
    const extra=edges.filter(edge=>!result.includes(edge));
    if(extra.length)result.push(extra[Math.floor(random()*Math.min(extra.length,3))]);
    return result;
  }
  function frozen() { focused = nodes.some(node => node.card.matches(':focus-visible')); return paused(); }
  function draw(now) {
    frame = 0;
    if (!active || !scene || document.hidden || pageHidden) return;
    if (now-lastFrame>=32 || motion.matches) {
      const freeze=frozen();
      if (previous && !freeze) time+=Math.min((now-previous)/1000,.05);
      previous=now;lastFrame=now;
      if(!freeze&&!hovered&&!focused&&!pointers.size){center.x+=(pointer.x-center.x)*.04;center.y+=(pointer.y-center.y)*.04;}
      scene.render(time,center,motion.matches,view);
    }
    if (!motion.matches && !frozen()) frame=requestAnimationFrame(draw);
  }
  function render() {
    stop();
    if(!active || !scene)return;
    scene.resize();
    scene.render(time,center,motion.matches,view);
    zoomLabel.value=Math.round(view.zoom*100)+'%';
    if(!motion.matches&&!frozen())frame=requestAnimationFrame(draw);
  }
  async function initialize() {
    if (scene || pending || failed || !active) return;
    const version=++ticket;
    pending=import('./vendor/three.module.min.js').then(THREE=>{
      if(version!==ticket||!active||pageHidden)return;
      scene=createScene(THREE);
      roster.classList.add('space-ready');roster.classList.remove('space-fallback');
      scene.setLayout(layout,sceneLinks);render();
    }).catch(()=>{
      if(version!==ticket)return;
      failed=true;destroyScene();roster.classList.add('space-fallback');
      nodes.forEach(node=>node.wrapper.style.removeProperty('transform'));
    }).finally(()=>{if(version===ticket)pending=null;});
    await pending;
  }
  function refresh() {
    const directory=visible();
    if(directory&&!directoryVisible){entries++;makeLayout();}
    directoryVisible=directory;
    const next=directory&&!document.hidden&&!pageHidden;
    if(next===active){if(next&&!scene&&!pending)initialize();return;}
    active=next;
    if(active){initialize();render();}else {stop();pointers.clear();gesture=null;roster.classList.remove('is-dragging');}
  }
  function destroyScene() {
    stop();scene?.dispose();scene=null;roster.classList.remove('space-ready');
  }
  function shuffle() {
    if(!visible())return;
    hovered=false;focused=false;
    pointer.x=pointer.y=center.x=center.y=0;
    view.panX=view.panY=0;view.zoom=1;makeLayout();render();
  }
  function resetView(){view.panX=view.panY=0;view.zoom=1;pointer.x=pointer.y=center.x=center.y=0;render();}
  function zoomAt(next,x=roster.clientWidth/2,y=roster.clientHeight/2){
    const zoom=Math.max(.45,Math.min(2.4,next)),old=view.zoom;
    view.panX+=(x/Math.max(1,roster.clientWidth)-.5)*(1/old-1/zoom);
    view.panY-=(y/Math.max(1,roster.clientHeight)-.5)*(1/old-1/zoom);
    view.zoom=zoom;render();
  }
  function panBy(dx,dy){view.panX-=dx/Math.max(1,roster.clientWidth)/view.zoom;view.panY+=dy/Math.max(1,roster.clientHeight)/view.zoom;render();}
  function measureGesture(){const points=[...pointers.values()];if(points.length>1){const [a,b]=points;return{x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.hypot(a.x-b.x,a.y-b.y)};}return points[0]?{...points[0],distance:0}:null;}
  roster.addEventListener('pointerdown',event=>{
    if(!active||event.button>0||event.target.closest('.space-controls'))return;
    const isCard=!!event.target.closest('.space-node');
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY,card:isCard});
    gesture=measureGesture();
    if(!isCard||pointers.size>1){event.preventDefault();roster.setPointerCapture(event.pointerId);roster.classList.add('is-dragging');}
  });
  roster.addEventListener('pointermove',event=>{
    if(!active||!pointers.has(event.pointerId))return;
    const old=pointers.get(event.pointerId);pointers.set(event.pointerId,{...old,x:event.clientX,y:event.clientY});
    const next=measureGesture();if(!gesture||!next){gesture=next;return;}
    if(pointers.size>1){
      event.preventDefault();const rect=roster.getBoundingClientRect();if(gesture.distance>1)zoomAt(view.zoom*next.distance/gesture.distance,next.x-rect.left,next.y-rect.top);
      panBy(next.x-gesture.x,next.y-gesture.y);suppressClick=true;
    }else if(!old.card){
      event.preventDefault();const dx=next.x-gesture.x,dy=next.y-gesture.y;if(Math.abs(dx)+Math.abs(dy)>1)suppressClick=true;panBy(dx,dy);
    }
    gesture=next;
  },{passive:false});
  const release=event=>{pointers.delete(event.pointerId);gesture=measureGesture();if(!pointers.size){roster.classList.remove('is-dragging');setTimeout(()=>{suppressClick=false;},0);}if(roster.hasPointerCapture(event.pointerId))roster.releasePointerCapture(event.pointerId);};
  roster.addEventListener('pointerup',release);roster.addEventListener('pointercancel',release);
  roster.addEventListener('click',event=>{if(suppressClick){suppressClick=false;event.preventDefault();event.stopImmediatePropagation();}},{capture:true});
  roster.addEventListener('wheel',event=>{if(!active)return;event.preventDefault();const rect=roster.getBoundingClientRect();zoomAt(view.zoom*Math.exp(-Math.max(-300,Math.min(300,event.deltaY))*.002),event.clientX-rect.left,event.clientY-rect.top);},{passive:false});
  roster.addEventListener('keydown',event=>{
    if(event.target.closest('.space-controls'))return;
    const moves={ArrowLeft:[-35,0],ArrowRight:[35,0],ArrowUp:[0,-35],ArrowDown:[0,35]};
    if(moves[event.key]){event.preventDefault();panBy(...moves[event.key]);}
    else if(event.key==='+'||event.key==='='){event.preventDefault();zoomAt(view.zoom*1.2);}
    else if(event.key==='-'){event.preventDefault();zoomAt(view.zoom/1.2);}
    else if(event.key==='Home'){event.preventDefault();resetView();}
  });
  shuffleButton.addEventListener('click',shuffle);
  for(const node of nodes){
    node.card.addEventListener('pointerenter',event=>{if(event.pointerType==='touch')return;node.hovered=true;hovered=true;node.lock=node.pose?{...node.pose}:null;});
    node.card.addEventListener('pointerleave',()=>{node.hovered=false;hovered=nodes.some(value=>value.hovered);if(!node.focused)node.lock=null;});
    node.card.addEventListener('focus',()=>{
      if(!node.card.matches(':focus-visible'))return;
      if(node.projected&&(node.projected.x<70||node.projected.y<90||node.projected.x>roster.clientWidth-70||node.projected.y>roster.clientHeight-90)){
        view.panX=node.position.u-.5;view.panY=.5-node.position.v;view.zoom=Math.min(view.zoom,1.4);render();
      }
      node.focused=true;focused=true;node.lock=node.pose?{...node.pose}:null;
    });
    node.card.addEventListener('blur',()=>{node.focused=false;focused=nodes.some(value=>value.focused);if(!node.hovered)node.lock=null;});
  }
  roster.addEventListener('pointermove',event=>{
    if(coarse.matches||event.pointerType==='touch'||motion.matches||hovered||focused)return;
    const rect=roster.getBoundingClientRect();
    pointer.x=Math.max(-1,Math.min(1,(event.clientX-rect.left)/rect.width*2-1));
    pointer.y=Math.max(-1,Math.min(1,(event.clientY-rect.top)/rect.height*2-1));
  },{passive:true});
  roster.addEventListener('pointerleave',()=>{pointer.x=pointer.y=0;if(!pointers.size){hovered=false;for(const node of nodes){node.hovered=false;if(!node.focused)node.lock=null;}}},{passive:true});
  const observer=new MutationObserver(refresh);
  [roster,section,database].forEach(element=>observer.observe(element,{attributes:true,attributeFilter:['hidden','class']}));
  const resizeObserver=new ResizeObserver(()=>{
    if(!active)return;
    const mobile=roster.clientWidth<600;
    if(layout.length&&layout[0].mobile!==mobile){makeLayout();layout.forEach(value=>value.mobile=mobile);}
    render();
  });
  resizeObserver.observe(roster);
  document.addEventListener('visibilitychange',refresh);
  motion.addEventListener('change',render);
  window.addEventListener('pagehide',()=>{
    pageHidden=true;active=false;directoryVisible=false;ticket++;pending=null;destroyScene();
  });
  window.addEventListener('pageshow',()=>{pageHidden=false;failed=false;refresh();});
  window.PlayersSpace={refresh,shuffle,resetView,getState:()=>({active,ready:!!scene,failed,entries,seed,view:{...view},framePending:!!frame,
    positions:nodes.map(node=>({id:node.card.id,slot:node.slot,...node.projected}))})};
  refresh();

  function createScene(THREE) {
    const renderer=new THREE.WebGLRenderer({alpha:true,antialias:false,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
    renderer.setClearColor(0x020409,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
    const canvas=renderer.domElement;canvas.setAttribute('aria-hidden','true');backdrop.append(canvas);
    const world=new THREE.Scene(),camera=new THREE.PerspectiveCamera(36,1,.1,60);
    camera.position.set(0,0,12);
    const group=new THREE.Group();world.add(group);
    const blue=new THREE.MeshStandardMaterial({color:0x104eac,metalness:.62,roughness:.3,emissive:0x062452,emissiveIntensity:.24});
    const edge=new THREE.LineBasicMaterial({color:0x3b7cce,transparent:true,opacity:.42});
    const lineMaterial=new THREE.MeshBasicMaterial({color:0x346aa8,transparent:true,opacity:.36});
    const ghostMaterial=new THREE.MeshStandardMaterial({color:0x1b5eb3,metalness:.55,roughness:.28,emissive:0x07316e,emissiveIntensity:.42});
    const segmentGeometries=[];
    for(let i=0;i<5;i++){
      const angle=(-90+i*72)*Math.PI/180,next=(-90+(i+1)*72)*Math.PI/180;
      const points=[new THREE.Vector2(Math.cos(angle),Math.sin(angle)),new THREE.Vector2(Math.cos(next),Math.sin(next)),
        new THREE.Vector2(Math.cos(next)*.32,Math.sin(next)*.32),new THREE.Vector2(Math.cos(angle)*.32,Math.sin(angle)*.32)];
      const mean=points.reduce((sum,p)=>sum.add(p),new THREE.Vector2()).multiplyScalar(.25);
      points.forEach(p=>p.sub(mean).multiplyScalar(.91).add(mean));
      const shape=new THREE.Shape(points);
      const geometry=new THREE.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:true,bevelSize:.018,bevelThickness:.025,bevelSegments:1,steps:1});
      geometry.translate(0,0,-.08);segmentGeometries.push(geometry);
    }
    const starCount=90,starPositions=new Float32Array(starCount*3);
    for(let i=0;i<starCount;i++){starPositions[i*3]=(random()-.5)*24;starPositions[i*3+1]=(random()-.5)*17;starPositions[i*3+2]=-2-random()*12;}
    const starGeometry=new THREE.BufferGeometry();starGeometry.setAttribute('position',new THREE.BufferAttribute(starPositions,3));
    const starMaterial=new THREE.PointsMaterial({color:0x6f9acb,size:.018,transparent:true,opacity:.55,depthWrite:false});
    const stars=new THREE.Points(starGeometry,starMaterial);world.add(stars);
    world.add(new THREE.AmbientLight(0x456394,1.1));
    const keyLight=new THREE.DirectionalLight(0xbcdcff,3.8);keyLight.position.set(-5,6,9);world.add(keyLight);
    const rimLight=new THREE.DirectionalLight(0x0c4de8,4);rimLight.position.set(5,-3,0);world.add(rimLight);
    const network=new THREE.Group();group.add(network);
    let emblems=[],links=[],width=1,height=1,unitsHeight=1,unitsWidth=1;
    const vector=new THREE.Vector3(),from=new THREE.Vector3(),to=new THREE.Vector3();
    const up=new THREE.Vector3(0,1,0);
    const linkGeometry=new THREE.CylinderGeometry(1,1,1,5,1,true);
    const screenPoint=new THREE.Vector3();
    let disposed=false;
    function setLayout(values,connections){
      for(const entry of emblems){network.remove(entry.group);entry.outline.geometry.dispose();}
      for(const link of links)network.remove(link.mesh);
      emblems=values.map(value=>{
        const emblem=new THREE.Group();network.add(emblem);
        segmentGeometries.forEach(geometry=>emblem.add(new THREE.Mesh(geometry,value.node?blue:ghostMaterial)));
        const outline=new THREE.LineSegments(new THREE.EdgesGeometry(segmentGeometries[0],35),edge);
        // Only one edge accent is needed; the solid five-piece relief does the rest.
        emblem.add(outline);
        return {group:emblem,value,outline};
      });
      links=connections.map(connection=>{const mesh=new THREE.Mesh(linkGeometry,lineMaterial);network.add(mesh);return{...connection,mesh};});
    }
    function resize(){
      if(disposed)return;
      width=Math.max(1,roster.clientWidth);height=Math.max(1,roster.clientHeight);
      camera.aspect=width/height;camera.updateProjectionMatrix();
      // DOM hit targets are projected before renderer.render() updates cameras.
      // Keep the very first frame correct, including static reduced motion.
      camera.updateMatrixWorld(true);renderer.setSize(width,height,false);
      unitsHeight=2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*12;
      unitsWidth=unitsHeight*camera.aspect;
    }
    function position(value,clock,still){
      const z=value.z+(!still?Math.sin(clock*.29+value.phase)*.18:0);
      const depth=(12-z)/12;
      const driftX=still?0:Math.sin(clock*.31+value.phase)*.13;
      const driftY=still?0:Math.cos(clock*.38+value.phase)*.15;
      return vector.set((value.u-.5)*unitsWidth*depth+driftX,(.5-value.v)*unitsHeight*depth+driftY,z);
    }
    function render(clock,parallax,still,view){
      if(disposed)return;
      camera.position.set(view.panX*unitsWidth,view.panY*unitsHeight,12/view.zoom);camera.updateMatrixWorld(true);
      // Small world parallax preserves clear hit targets and keeps all cards in view.
      group.rotation.y=still?0:parallax.x*.012;group.rotation.x=still?0:parallax.y*.009;
      for(const entry of emblems){
        const {value}=entry;
        const pose=position(value,clock,still);if(value.node?.lock)pose.set(value.node.lock.x,value.node.lock.y,value.node.lock.z);
        entry.group.position.copy(pose);
        const nodeWidth=value.node?.wrapper.offsetWidth||86;
        const size=(nodeWidth/width)*unitsWidth*(12-value.z)/12*(value.node ? .80 : .55);
        entry.group.scale.setScalar(size);
        entry.group.rotation.set(value.node?-.07:.12,value.angle+(!still?Math.sin(clock*.2+value.phase)*.08:0),value.angle);
      }
      network.updateMatrixWorld(true);
      for(const link of links){
        from.copy(emblems[link.a].group.position);to.copy(emblems[link.b].group.position);
        link.mesh.position.copy(from).add(to).multiplyScalar(.5);vector.copy(to).sub(from);
        link.mesh.quaternion.setFromUnitVectors(up,vector.clone().normalize());
        link.mesh.scale.set(.007,vector.length(),.007);
      }
      group.updateMatrixWorld(true);
      for(const entry of emblems)if(entry.value.node){
        const node=entry.value.node;
        screenPoint.copy(entry.group.position);group.localToWorld(screenPoint);screenPoint.project(camera);
        const x=(screenPoint.x*.5+.5)*width,y=(-screenPoint.y*.5+.5)*height;
        const z=entry.group.position.z,scale=Math.max(.25,Math.min(3.2,12/(12/view.zoom-z)));
        const roll=node.lock?.roll??(entry.value.angle+(still?0:Math.sin(clock*.21+entry.value.phase)*.035));
        node.pose={x:entry.group.position.x,y:entry.group.position.y,z,roll};
        node.projected={x,y,scale,z};
        node.wrapper.style.transform=`translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) translate(-50%,-50%) scale(${scale.toFixed(4)}) rotate(${(roll*180/Math.PI).toFixed(2)}deg)`;
      }
      stars.rotation.z=still?0:Math.sin(clock*.035)*.012;
      renderer.render(world,camera);
    }
    const lost=event=>{
      event.preventDefault();failed=true;destroyScene();roster.classList.add('space-fallback');
      nodes.forEach(node=>node.wrapper.style.removeProperty('transform'));
    };
    canvas.addEventListener('webglcontextlost',lost);
    resize();
    return {setLayout,resize,render,dispose(){
      if(disposed)return;disposed=true;canvas.removeEventListener('webglcontextlost',lost);
      const geometries=new Set(),materials=new Set();
      world.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material)(Array.isArray(object.material)?object.material:[object.material]).forEach(value=>materials.add(value));});
      segmentGeometries.forEach(value=>geometries.add(value));geometries.add(linkGeometry);
      geometries.forEach(value=>value.dispose());materials.forEach(value=>value.dispose());
      renderer.dispose();renderer.forceContextLoss();canvas.remove();
    }};
  }
})();
