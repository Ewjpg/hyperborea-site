// Минами Син: the sculpted spider lily (assets/minami-lycoris.bin + .webp, see assets/minami-lycoris-SOURCE.txt).
// The mesh is one piece, so folding into a bud, wilting, wind and pokes are done in the vertex shader;
// nothing is rebuilt per frame. The hub, where the florets branch off the stem, is at the origin.
// The files are fetched and decoded once and shared by the opening and the dossier flower.
import * as T from './vendor/three.module.min.js';

const MESH_URL = './assets/minami-lycoris.bin?v=1';
const TEXTURE_URL = './assets/minami-lycoris.webp?v=1';
const POKES = 3;

// Layout written by the converter: "LYC1", header length, JSON header, then
// uint16 positions (over min/size), int8 normals (xyz + pad), uint16 uvs, uint16/uint32 indices.
function decode(buffer){
  const view=new DataView(buffer);
  if(view.getUint32(0,true)!==0x3143594c)throw new Error('Not a Minami lycoris mesh');
  const length=view.getUint32(4,true),header=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,8,length)));
  let offset=8+length;
  const take=(Type,count)=>{const bytes=count*Type.BYTES_PER_ELEMENT,array=new Type(buffer.slice(offset,offset+bytes));offset+=bytes;return array;};
  const count=header.vertices,packed=take(Uint16Array,count*3);
  if((count*6)%4)offset+=2;
  const normals=take(Int8Array,count*4),uvs=take(Uint16Array,count*2);
  const index=take(header.indexType==='u16'?Uint16Array:Uint32Array,header.indices);
  const positions=new Float32Array(count*3);
  for(let i=0;i<count*3;i++)positions[i]=header.min[i%3]+packed[i]/65535*header.size[i%3];
  return {positions,normals,uvs,index,anchors:header.anchors};
}

let loading=null,loaded=null;
/** Starts (once) fetching and decoding the model; resolves with the shared data. */
export function preloadLycoris(){
  if(!loading){
    loading=Promise.all([
      fetch(MESH_URL).then(response=>{if(!response.ok)throw new Error('Lycoris mesh '+response.status);return response.arrayBuffer();}).then(decode),
      new Promise((resolve,reject)=>{const image=new Image();image.decoding='async';image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Lycoris texture'));image.src=TEXTURE_URL;})
    ]).then(([data,image])=>{loaded={...data,image};return loaded;});
    loading.catch(()=>{loading=null;});
  }
  return loading;
}
/** The decoded model if it has already arrived, otherwise null. */
export const lycorisReady=()=>loaded;

const DEFORM=`
uniform float uFold;uniform float uWither;uniform float uTime;
uniform vec4 uPoke[${POKES}];uniform float uPokePower[${POKES}];uniform float uPokeReach[${POKES}];
vec3 lycorisTurn(vec3 v,vec3 axis,float angle){float c=cos(angle),s=sin(angle);return v*c+cross(axis,v)*s+axis*dot(axis,v)*(1.-c);}
void lycorisDeform(inout vec3 p,inout vec3 n){
  float rho=length(p),r=length(p.xz);
  float phi=atan(r,p.y);
  // The stem hangs straight down from the hub and never folds.
  float keep=1.-smoothstep(2.2,2.7,phi);
  vec2 d=r>1e-5?p.xz/r:vec2(1.,0.);
  vec3 axis=vec3(d.y,0.,-d.x);
  // Wilting: the petals shrivel and hang down from their florets.
  float dying=uWither*keep*smoothstep(.25,1.6,rho);
  if(dying>0.){p=lycorisTurn(p,axis,dying*.6);n=lycorisTurn(n,axis,dying*.6);p.xz*=1.-.2*dying;}
  // Folding into a bud: every part swings up toward the stem's axis, then the bud twists and slims.
  float k=uFold*keep*smoothstep(0.,.18,rho);
  if(k>0.){
    phi=atan(length(p.xz),p.y);
    float angle=-phi*.9*k;
    p=lycorisTurn(p,axis,angle);n=lycorisTurn(n,axis,angle);
    float twist=k*.75*smoothstep(0.,2.,rho);
    p=lycorisTurn(p,vec3(0.,1.,0.),twist);n=lycorisTurn(n,vec3(0.,1.,0.),twist);
    p.xz*=1.-.35*k;p.y*=1.-.12*k;
  }
  // Wind moves the tips more than the base; a dying flower barely moves.
  float sway=smoothstep(.2,2.,rho)*(1.-uFold*.7)*keep*(1.-uWither*.7);
  p.x+=sin(uTime*1.3+p.y*2.1+p.z*1.7)*.025*sway;
  p.z+=cos(uTime*1.1+p.x*1.9)*.02*sway;
  // A poke sends a damped ripple out from the touched point.
  for(int i=0;i<${POKES};i++){
    float age=uTime-uPoke[i].w;
    if(age<0.||age>2.5)continue;
    vec3 away=p-uPoke[i].xyz;
    p+=normalize(p+vec3(0.,.4,0.))*sin(age*20.)*exp(-age*3.)*exp(-dot(away,away)*uPokeReach[i])*.09*uPokePower[i];
  }
  // The dying head droops to one side on a stem that bends from below.
  float bend=uWither*.55*smoothstep(-2.8,.25,p.y);
  if(bend>0.){vec3 pivot=vec3(0.,-2.8,0.);p=pivot+lycorisTurn(p-pivot,vec3(0.,0.,1.),-bend);n=lycorisTurn(n,vec3(0.,0.,1.),-bend);}
}`;

/** Builds one flower from the decoded data, with the interface minami-garden.mjs and minami-opening.mjs use. */
export function createLycoris(data,{renderer,low=false}={}){
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.BufferAttribute(data.positions,3));
  geometry.setAttribute('normal',new T.InterleavedBufferAttribute(new T.InterleavedBuffer(data.normals,4),3,0,true));
  geometry.setAttribute('uv',new T.BufferAttribute(data.uvs,2,true));
  geometry.setIndex(new T.BufferAttribute(data.index,1));
  geometry.computeBoundingSphere();
  const texture=new T.Texture(data.image);texture.colorSpace=T.SRGBColorSpace;texture.needsUpdate=true;
  texture.anisotropy=Math.min(8,renderer?.capabilities.getMaxAnisotropy()||1);
  const uniforms={uFold:{value:1},uWither:{value:0},uTime:{value:0},
    uPoke:{value:Array.from({length:POKES},()=>new T.Vector4(0,0,0,-99))},uPokePower:{value:new Array(POKES).fill(0)},uPokeReach:{value:new Array(POKES).fill(2.2)}};
  // The painted texture is a light coral; the tint deepens it toward the crimson of the dossier.
  const sheen=low?0:.6;
  const material=new T.MeshPhysicalMaterial({map:texture,color:new T.Color('#ff9c9c'),roughness:.5,metalness:0,
    sheen,sheenColor:new T.Color('#ff5a6a'),sheenRoughness:.5,emissive:new T.Color('#3a0207'),emissiveIntensity:.35,side:T.DoubleSide});
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\n'+DEFORM)
      .replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nvec3 lycorisPosition=position;lycorisDeform(lycorisPosition,objectNormal);')
      .replace('#include <begin_vertex>','vec3 transformed=lycorisPosition;');
    // A dying flower drains toward a dry, dark brown.
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\nuniform float uWither;')
      .replace('#include <map_fragment>','#include <map_fragment>\nfloat lycorisGrey=dot(diffuseColor.rgb,vec3(.3,.59,.11));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(lycorisGrey)*vec3(.62,.4,.34),uWither*.85)*(1.-uWither*.5);');
  };
  const group=new T.Group();group.name='Minami / sculpted Lycoris radiata';
  const mesh=new T.Mesh(geometry,material);mesh.frustumCulled=false;group.add(mesh);
  // The hub and floret anchors follow the dying head's nod (the same bend as the shader, around the same pivot).
  const nod=new T.Group();nod.position.set(0,-2.8,0);group.add(nod);
  const head=new T.Group();head.position.set(0,2.8,0);nod.add(head);
  const hub=new T.Object3D();head.add(hub);
  const anchors=data.anchors.map(([x,y,z])=>{const anchor=new T.Object3D();anchor.position.set(x,y,z);head.add(anchor);return anchor;});
  let nextPoke=0,time=0;
  const local=new T.Vector3();
  function pulse(x,y,z,power,reach){uniforms.uPoke.value[nextPoke].set(x,y,z,time);uniforms.uPokePower.value[nextPoke]=power;uniforms.uPokeReach.value[nextPoke]=reach;nextPoke=(nextPoke+1)%POKES;}
  return {
    kind:'model',group,hub,anchors,pick:[mesh],
    update(progress,seconds){time=seconds;uniforms.uFold.value=1-T.MathUtils.clamp(progress,0,1);uniforms.uTime.value=seconds;},
    poke(hit,power=1){
      if(hit.object!==mesh)return false;
      mesh.worldToLocal(local.copy(hit.point));pulse(local.x,local.y,local.z,power,2.2);
      return true;
    },
    // A burst ripples the whole head from its centre.
    shake(power){pulse(0,.5,0,power*1.4,.45);},
    wither(amount){
      const w=T.MathUtils.clamp(amount,0,1);uniforms.uWither.value=w;nod.rotation.z=-w*.55;
      material.emissiveIntensity=.35*(1-w*.85);material.sheen=sheen*(1-w*.8);
    },
    dispose(){geometry.dispose();material.dispose();texture.dispose();group.removeFromParent();group.clear();}
  };
}

/** Resolves with a ready flower (loads the files first if needed). */
export async function loadLycoris(options){return createLycoris(await preloadLycoris(),options);}
