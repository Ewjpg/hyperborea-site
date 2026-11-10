import * as T from './vendor/three.module.min.js';

export function createFearKit(root, seed, detail = 'normal') {
  let value = seed >>> 0;
  const rng = () => {value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296;};
  const ticks = [];
  const materials = new Set();
  const geometries = new Set();
  const smooth = detail === 'low' ? 8 : 12;
  const add = (geometry, material, parent = root) => {
    geometries.add(geometry);
    const object = new T.Mesh(geometry, material);
    object.castShadow = false; object.receiveShadow = false;
    parent.add(object); return object;
  };
  const position = (object, x, y, z) => {object.position.set(x, y, z);return object;};
  const api = {
    T, root, rng, detail,
    mat(color, options = {}) {
      const material = new T.MeshStandardMaterial({color, roughness: .57, metalness: .22, ...options});
      materials.add(material); return material;
    },
    group(x = 0, y = 0, z = 0, parent = root) {const group = new T.Group();parent.add(group);return position(group,x,y,z);},
    mesh: add,
    sphere(r,x,y,z,m,sx=1,sy=1,sz=1,parent=root) {
      const object = position(add(new T.SphereGeometry(r,smooth,smooth),m,parent),x,y,z);
      object.scale.set(sx,sy,sz);return object;
    },
    box(w,h,d,x,y,z,m,parent=root) {return position(add(new T.BoxGeometry(w,h,d),m,parent),x,y,z);},
    cylinder(a,b,h,x,y,z,m,parent=root) {return position(add(new T.CylinderGeometry(a,b,h,smooth),m,parent),x,y,z);},
    ring(r,t,x,y,z,m,parent=root) {return position(add(new T.TorusGeometry(r,t,6,detail==='low'?24:40),m,parent),x,y,z);},
    link(a,b,r,m,parent=root) {
      const start=new T.Vector3(...a),end=new T.Vector3(...b),delta=end.clone().sub(start);
      const object=add(new T.CylinderGeometry(r,r,delta.length(),6),m,parent);
      object.position.copy(start.add(end).multiplyScalar(.5));
      object.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return object;
    },
    tube(points,r,m,parent=root) {
      const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
      return add(new T.TubeGeometry(curve,detail==='low'?18:30,r,5,false),m,parent);
    },
    onTick(fn) {ticks.push(fn);},
    tick(t,dt,pointer,pulse) {for(const fn of ticks)fn(t,dt,pointer,pulse);},
    dispose() {
      root.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material)for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material);});
      for(const geometry of geometries)geometry.dispose();
      for(const material of materials)material.dispose();
      root.clear(); ticks.length=0;
    }
  };
  return api;
}

// WebGL-less devices receive the same geometry, projected and shaded on a 2D canvas.
// This keeps each fear distinct and dimensional without a network or GPU dependency.
export function createSoftwareFearRenderer(canvas, scene, camera) {
  const context=canvas.getContext('2d',{alpha:true});
  const light=new T.Vector3(-.3,.8,1).normalize(),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
  const normal=new T.Vector3(),u=new T.Vector3(),v=new T.Vector3(),projected=new T.Vector3();
  let width=1,height=1;
  return {
    setSize(w,h) {width=w;height=h;canvas.width=w;canvas.height=h;},
    render() {
      scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);const faces=[];
      scene.traverse(mesh=>{
        if(!mesh.isMesh||!mesh.visible)return;
        let ancestor=mesh.parent;while(ancestor){if(!ancestor.visible)return;ancestor=ancestor.parent;}
        const geometry=mesh.geometry,attribute=geometry.attributes.position,index=geometry.index;
        const material=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;
        if(!attribute||!material||material.opacity<.02)return;
        const total=index?index.count:attribute.count;
        const step=3;
        for(let i=0;i<total-2;i+=step){
          a.fromBufferAttribute(attribute,index?index.getX(i):i).applyMatrix4(mesh.matrixWorld);
          b.fromBufferAttribute(attribute,index?index.getX(i+1):i+1).applyMatrix4(mesh.matrixWorld);
          c.fromBufferAttribute(attribute,index?index.getX(i+2):i+2).applyMatrix4(mesh.matrixWorld);
          normal.crossVectors(u.copy(b).sub(a),v.copy(c).sub(a)).normalize();
          if(material.side!==T.DoubleSide&&normal.dot(u.copy(camera.position).sub(a))<=0)continue;
          const points=[a,b,c].map(point=>{projected.copy(point).project(camera);return [(projected.x*.5+.5)*width,(-projected.y*.5+.5)*height,projected.z];});
          if(points.some(point=>point[2]<-1||point[2]>1))continue;
          const illumination=.3+.7*Math.max(0,normal.dot(light));
          const color=material.color||new T.Color('#999');const emissive=material.emissive;
          const rgb=['r','g','b'].map(channel=>Math.round(Math.min(1,color[channel]*illumination+(emissive?emissive[channel]*(material.emissiveIntensity||0):0))*255));
          faces.push({points,depth:(points[0][2]+points[1][2]+points[2][2])/3,color:`rgba(${rgb.join(',')},${material.opacity})`});
        }
      });
      faces.sort((a,b)=>b.depth-a.depth);context.clearRect(0,0,width,height);
      for(const face of faces){context.fillStyle=face.color;context.beginPath();face.points.forEach((p,i)=>i?context.lineTo(p[0],p[1]):context.moveTo(p[0],p[1]));context.closePath();context.fill();}
    },
    dispose(){context.clearRect(0,0,width,height);}
  };
}
