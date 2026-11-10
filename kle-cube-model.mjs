// A legal 3×3 cube: every turn rotates both integer cubie positions and stickers.
export const FACES=Object.freeze(['U','R','F','D','L','B']);
export const FACE_INFO=Object.freeze({
 U:{axis:1,layer:1,sign:-1,normal:[0,1,0]},R:{axis:0,layer:1,sign:-1,normal:[1,0,0]},
 F:{axis:2,layer:1,sign:-1,normal:[0,0,1]},D:{axis:1,layer:-1,sign:1,normal:[0,-1,0]},
 L:{axis:0,layer:-1,sign:1,normal:[-1,0,0]},B:{axis:2,layer:-1,sign:1,normal:[0,0,-1]}
});
const normalKey=normal=>normal.join(',');
export function faceForNormal(normal){return FACES.find(face=>normalKey(FACE_INFO[face].normal)===normalKey(normal))||null;}
function quarterValue(value){if(!Number.isInteger(value))throw new TypeError('A face turn requires integer quarter turns.');const n=((value%4)+4)%4;return n===3?-1:n;}
function rotate(vector,axis,quarter){let [x,y,z]=vector;for(let i=0;i<((quarter%4)+4)%4;i++){if(axis===0)[y,z]=[-z,y];else if(axis===1)[x,z]=[z,-x];else[x,y]=[-y,x];}return[x,y,z].map(n=>n===0?0:n);}
function initialCubies(){const result=[];for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){if(!x&&!y&&!z)continue;const position=[x,y,z],stickers=[];for(const face of FACES){const info=FACE_INFO[face];if(position[info.axis]===info.layer)stickers.push({color:face,normal:[...info.normal]});}result.push({id:position.join(':'),position,stickers});}return result;}
function copyCubie(cubie){return{id:cubie.id,position:[...cubie.position],stickers:cubie.stickers.map(sticker=>({color:sticker.color,normal:[...sticker.normal]}))};}
function faceletIndex(face,[x,y,z]){const row=face==='U'?z+1:face==='D'?1-z:1-y;const column=face==='R'?1-z:face==='L'?z+1:face==='B'?1-x:x+1;return row*3+column;}

export function createCubeModel(){
 let cubies=initialCubies(),history=[];
 function turn(face,quarter=1){
  if(!FACE_INFO[face])throw new TypeError('Unknown cube face.');
  const amount=quarterValue(quarter);if(!amount)return false;
  const {axis,layer,sign}=FACE_INFO[face];
  for(const cubie of cubies)if(cubie.position[axis]===layer){cubie.position=rotate(cubie.position,axis,amount*sign);for(const sticker of cubie.stickers)sticker.normal=rotate(sticker.normal,axis,amount*sign);}
  const previous=history.at(-1);
  if(previous?.face===face){const combined=quarterValue(previous.quarter+amount);history.pop();if(combined)history.push({face,quarter:combined});}
  else history.push({face,quarter:amount});
  return true;
 }
 function reset(){cubies=initialCubies();history=[];}
 function scramble(count=4,rng=Math.random){
  reset();const sequence=[];let previous=null;
  for(let i=0;i<Math.max(1,Math.min(30,Math.round(count)));i++){
   const choices=FACES.filter(face=>!previous||FACE_INFO[face].axis!==FACE_INFO[previous].axis);
   const random=Number(rng()),index=Math.min(choices.length-1,Math.max(0,Math.floor((Number.isFinite(random)?random:0)*choices.length)));
   const face=choices[index],quarter=Number(rng())<.5?1:-1;turn(face,quarter);sequence.push({face,quarter});previous=face;
  }
  return sequence.map(move=>({...move}));
 }
 function facelets(){const faces=Object.fromEntries(FACES.map(face=>[face,Array(9).fill(null)]));for(const cubie of cubies)for(const sticker of cubie.stickers){const face=faceForNormal(sticker.normal);faces[face][faceletIndex(face,cubie.position)]=sticker.color;}return faces;}
 function isSolved(){const faces=facelets();return FACES.every(face=>faces[face].every(color=>color===face));}
 return{turn,reset,scramble,isSolved,get cubies(){return cubies.map(copyCubie);},get history(){return history.map(move=>({...move}));},get inverse(){return history.slice().reverse().map(move=>({face:move.face,quarter:move.quarter===2?2:-move.quarter}));},get facelets(){return facelets();}};
}
