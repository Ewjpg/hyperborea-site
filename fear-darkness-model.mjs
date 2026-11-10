// The fear of darkness has no edges: the ground is cut into chunks that are generated from a seed
// whenever the player comes near, so a place looks the same when you return and the world never ends.
// Pure data only — fear-world.js turns it into meshes, tests/fear-darkness-model.mjs checks it.
export const CHUNK=16;
export const PLAYER_RADIUS=.34;
export const EYE_RADIUS=1.1;
const CLEARING=6.5;
// The eye is met three times: twice it escapes deeper into the dark, the third time it lets you touch it.
export const EYE_DISTANCES=[[66,82],[92,112],[106,128]];

export function hash(x,z,seed){
  let h=(seed^Math.imul(x|0,374761393)^Math.imul(z|0,668265263))|0;
  h=Math.imul(h^h>>>13,1274126177);
  return (h^h>>>16)>>>0;
}
export function random(seed){
  let state=seed>>>0;
  return()=>{state=Math.imul(state,1664525)+1013904223>>>0;return state/4294967296;};
}

function generate(cx,cz,seed){
  const r=random(hash(cx,cz,seed)),x0=cx*CHUNK,z0=cz*CHUNK,items=[],solid=[];
  const spot=(margin,spacing)=>{
    for(let attempt=0;attempt<8;attempt++){
      const x=x0+margin+r()*(CHUNK-margin*2),z=z0+margin+r()*(CHUNK-margin*2);
      if(solid.every(item=>Math.hypot(item.x-x,item.z-z)>spacing))return{x,z};
    }
    return null;
  };
  // Slabs: black monoliths that rise past the reach of the light.
  for(let i=0,n=1+Math.floor(r()*2.6);i<n;i++){
    const at=spot(1.4,4.2);if(!at)continue;
    const item={kind:'slab',...at,w:.7+r()*1.6,d:.6+r()*1.2,h:7+r()*13,yaw:r()*Math.PI};
    items.push(item);solid.push(item);
  }
  // Columns: three strands twisted around each other.
  if(r()<.55){const at=spot(1.2,4);if(at){const item={kind:'column',...at,radius:.55,h:12+r()*10,yaw:r()*Math.PI*2,variant:Math.floor(r()*2)};items.push(item);solid.push(item);}}
  // Rare arches give the eye something to remember a place by.
  if(r()<.12){const at=spot(4,6);if(at){const item={kind:'arch',...at,yaw:r()*Math.PI,span:4.2+r()*1.6};items.push(item);solid.push(item);}}
  // Threads hang out of the dark above; roots crawl on the floor. Neither blocks the way.
  for(let i=0,n=2+Math.floor(r()*4);i<n;i++)items.push({kind:'thread',x:x0+r()*CHUNK,z:z0+r()*CHUNK,bottom:.5+r()*3.2,phase:r()*Math.PI*2,thickness:.6+r()*.9});
  for(let i=0,n=Math.floor(r()*2.4);i<n;i++)items.push({kind:'root',x:x0+r()*CHUNK,z:z0+r()*CHUNK,yaw:r()*Math.PI*2,scale:.7+r()*.8,variant:Math.floor(r()*3)});
  return items;
}

// Circles and oriented boxes on the ground plane; yaw follows three.js (rotation.y).
function colliderShapes(item){
  if(item.kind==='slab')return[{box:true,x:item.x,z:item.z,hw:item.w/2,hd:item.d/2,yaw:item.yaw}];
  if(item.kind==='column')return[{x:item.x,z:item.z,radius:item.radius}];
  if(item.kind==='arch'){const c=Math.cos(item.yaw),s=Math.sin(item.yaw),h=item.span/2;return[{x:item.x+c*h,z:item.z-s*h,radius:.45},{x:item.x-c*h,z:item.z+s*h,radius:.45}];}
  return[];
}
function overlaps(shape,x,z,radius){
  const dx=x-shape.x,dz=z-shape.z;
  if(!shape.box)return Math.hypot(dx,dz)<shape.radius+radius;
  const c=Math.cos(shape.yaw),s=Math.sin(shape.yaw);
  const lx=dx*c-dz*s,lz=dx*s+dz*c;
  const qx=Math.max(-shape.hw,Math.min(shape.hw,lx)),qz=Math.max(-shape.hd,Math.min(shape.hd,lz));
  return Math.hypot(lx-qx,lz-qz)<radius;
}

export function createDarknessModel(seed=1){
  const cache=new Map();
  // The start and every place the eye has been stay clear, so nothing ever appears inside the player.
  const clearings=[{x:0,z:0,radius:5}];
  let eye=null;
  const isClear=item=>item.kind==='thread'||item.kind==='root'||clearings.every(c=>Math.hypot(item.x-c.x,item.z-c.z)>c.radius+(item.kind==='arch'?item.span/2:0));
  function chunk(cx,cz){
    const key=cx+','+cz;
    let items=cache.get(key);
    if(!items){items=generate(cx,cz,seed);cache.set(key,items);if(cache.size>400)cache.delete(cache.keys().next().value);}
    return items.filter(isClear);
  }
  const chunkOf=v=>Math.floor(v/CHUNK);
  function itemsAround(x,z,range=2){
    const cx=chunkOf(x),cz=chunkOf(z),list=[];
    for(let i=-range;i<=range;i++)for(let j=-range;j<=range;j++)list.push(...chunk(cx+i,cz+j));
    return list;
  }
  function blocked(x,z,radius=PLAYER_RADIUS){
    if(eye&&Math.hypot(x-eye.x,z-eye.z)<EYE_RADIUS+radius)return true;
    for(const item of itemsAround(x,z,1))for(const shape of colliderShapes(item))if(overlaps(shape,x,z,radius))return true;
    return false;
  }
  // Slides along obstacles: each axis is tried on its own, like walking along a wall.
  function move(position,dx,dz,radius=PLAYER_RADIUS){
    if(!blocked(position.x+dx,position.z,radius))position.x+=dx;
    if(!blocked(position.x,position.z+dz,radius))position.z+=dz;
    return position;
  }
  // forwardYaw keeps a relocated eye out of the player's view: it always escapes behind or to the side.
  function placeEye(from,stage,roll=Math.random,forwardYaw=null){
    const [near,far]=EYE_DISTANCES[Math.min(stage,EYE_DISTANCES.length-1)];
    const distance=near+(far-near)*roll();
    const angle=forwardYaw===null?roll()*Math.PI*2:forwardYaw+Math.PI/3+roll()*Math.PI*4/3;
    // Facing yaw θ looks along (-sin θ, -cos θ), the camera convention in fear-world.js.
    eye={x:from.x-Math.sin(angle)*distance,z:from.z-Math.cos(angle)*distance,stage};
    clearings.push({x:eye.x,z:eye.z,radius:CLEARING});
    return {...eye,distance};
  }
  return{chunk,itemsAround,blocked,move,placeEye,chunkOf,
    clearEye(){eye=null;},
    get eye(){return eye&&{...eye};},
    get clearings(){return clearings.map(c=>({...c}));}};
}
