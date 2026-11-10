(() => {
  'use strict';
  const database=document.getElementById('database'),dossier=document.getElementById('wahDossier'),overlay=document.getElementById('wahPuzzleOverlay');
  if(!database||!dossier)return;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const ns='http://www.w3.org/2000/svg';
  // Adjacent edges share a curve, so the backdrop is a connected jigsaw.
  function tilePath(col,row,count=3,size=100,x=col*100+30,y=row*100+30){
    const n=value=>Number(value.toFixed(2));let path=`M${n(x)} ${n(y)}`;
    const direction=(a,b)=>(a+b)%2?1:-1;
    function edge(ax,ay,bx,by,sign){
      if(!sign){path+=`L${n(bx)} ${n(by)}`;return;}
      const dx=bx-ax,dy=by-ay,length=Math.hypot(dx,dy),nx=-dy/length,ny=dx/length,amplitude=size*.12*sign;
      const point=(t,b)=>[n(ax+dx*t+nx*amplitude*b),n(ay+dy*t+ny*amplitude*b)].join(' ');
      path+='L'+point(.36,0)+'C'+point(.44,0)+' '+point(.44,.2)+' '+point(.41,.55);
      path+='C'+point(.36,1.35)+' '+point(.43,1.65)+' '+point(.5,1.65);
      path+='C'+point(.57,1.65)+' '+point(.64,1.35)+' '+point(.59,.55);
      path+='C'+point(.56,.2)+' '+point(.56,0)+' '+point(.64,0)+'L'+point(1,0);
    }
    edge(x,y,x+size,y,row===0?0:direction(col,row));
    edge(x+size,y,x+size,y+size,col===count-1?0:direction(col+1,row));
    edge(x+size,y+size,x,y+size,row===count-1?0:-direction(col,row+1));
    edge(x,y+size,x,y,col===0?0:-direction(col,row));return path+'Z';
  }
  const board=document.createElementNS(ns,'svg');board.classList.add('wah-puzzle-board');board.setAttribute('viewBox','0 0 360 360');board.setAttribute('aria-hidden','true');
  for(let row=0;row<3;row++)for(let col=0;col<3;col++){
    const path=document.createElementNS(ns,'path');path.setAttribute('d',tilePath(col,row));
    path.classList.add('wah-board-tile');if((row===0&&col===2)||(row===2&&col===0))path.classList.add('is-blue');
    board.append(path);
  }
  dossier.querySelector('.wah-scene')?.prepend(board);
  const layer=document.createElement('div');layer.className='wah-rain-layer';layer.id='wahPuzzleRain';layer.hidden=true;layer.setAttribute('aria-hidden','true');
  const canvas=document.createElement('canvas');canvas.className='wah-rain-canvas';layer.append(canvas);database.prepend(layer);
  let ctx=null,path=null;
  try{ctx=canvas.getContext('2d');path=new Path2D(tilePath(1,1,3,100,0,0));}catch{}
  let width=1,height=1,particles=[],frame=0,previous=0,elapsed=0,active=false,frames=0,pageHidden=false;
  const random=(min,max)=>min+Math.random()*(max-min);
  function contentWidth(){const style=getComputedStyle(database);return Math.max(1,database.clientWidth-(parseFloat(style.paddingLeft)||0)-(parseFloat(style.paddingRight)||0));}
  function resize(){
    width=contentWidth();height=Math.max(1,database.clientHeight);
    const dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    canvas.style.width=width+'px';canvas.style.height=height+'px';layer.style.setProperty('--rain-height',height+'px');layer.style.width=width+'px';
    ctx?.setTransform(dpr,0,0,dpr,0,0);
    const count=width<650?13:26;
    particles=Array.from({length:count},(_,i)=>({x:random(0,width),y:i<3?random(-90,20):random(0,height),size:random(18,width<650?36:58),speed:random(25,58),phase:random(0,Math.PI*2),spin:random(-.22,.22),angle:random(-1,1),alpha:random(.2,.46)}));
    if(active)draw();
  }
  function draw(){
    if(!ctx||!path)return;ctx.clearRect(0,0,width,height);
    for(const particle of particles){
      const x=particle.x+Math.sin(elapsed*.33+particle.phase)*17;
      const y=particle.y;
      const tilt=.55+Math.abs(Math.cos(elapsed*.22+particle.phase))*.45;
      ctx.save();ctx.translate(x,y);ctx.rotate(particle.angle+elapsed*particle.spin);ctx.scale(particle.size/100*tilt,particle.size/100);ctx.translate(-50,-50);
      ctx.globalAlpha=particle.alpha;ctx.fillStyle='#0d3c99';ctx.translate(3,5);ctx.fill(path);ctx.translate(-3,-5);
      ctx.fillStyle='#1764ed';ctx.shadowColor='#125bde22';ctx.shadowBlur=10;ctx.fill(path);ctx.shadowBlur=0;
      ctx.strokeStyle='#a5ccff';ctx.lineWidth=1.6;ctx.stroke(path);ctx.restore();
    }
    frames++;
  }
  function stop(){cancelAnimationFrame(frame);frame=0;previous=0;}
  function tick(now){
    frame=0;if(!active||document.hidden||motion.matches||pageHidden)return;
    if(!previous||now-previous>=32){
      const dt=previous?Math.min((now-previous)/1000,.08):0;previous=now;elapsed+=dt;
      for(const particle of particles){particle.y+=particle.speed*dt;if(particle.y>height+particle.size*1.7){particle.y=-particle.size*1.8;particle.x=random(0,width);}}
      draw();
    }
    frame=requestAnimationFrame(tick);
  }
  function refresh(){
    const visible=!dossier.hidden&&database.classList.contains('wah-theme')&&database.classList.contains('active');
    layer.hidden=!visible;
    const next=visible&&!window.WahArchive?.busy&&!document.hidden&&!pageHidden;
    stop();active=next;
    if(!active)return;
    if(width!==contentWidth()||height!==database.clientHeight||!particles.length)resize();
    draw();if(!motion.matches&&ctx)frame=requestAnimationFrame(tick);
  }
  const observer=new MutationObserver(refresh);
  for(const target of [dossier,database,overlay].filter(Boolean))observer.observe(target,{attributes:true,attributeFilter:['hidden','class']});
  new ResizeObserver(()=>{if(!layer.hidden){resize();refresh();}}).observe(database);
  document.addEventListener('visibilitychange',refresh);motion.addEventListener('change',refresh);
  window.addEventListener('pagehide',()=>{pageHidden=true;active=false;stop();layer.hidden=true;});
  window.addEventListener('pageshow',()=>{pageHidden=false;refresh();});
  window.KlePuzzle={getState:()=>({active,frames,framePending:!!frame,particles:particles.length,reducedMotion:motion.matches})};
  refresh();
})();
