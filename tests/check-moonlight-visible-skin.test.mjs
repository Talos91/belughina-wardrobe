import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {MeshoptDecoder} from '../dist/vendor/libs/meshopt_decoder.module.js';
import {GLTFLoader} from '../dist/vendor/loaders/GLTFLoader.js';
import {WardrobeAssets} from '../dist/wardrobe-assets.js';
import {CharacterMotion} from '../dist/character-motion.js';
import {DEFAULT_STATE} from '../dist/wardrobe-state.js';
import {captureCoverage} from './wardrobe-coverage-probe.mjs';

globalThis.self=globalThis;
globalThis.createImageBitmap=async()=>({width:2048,height:2048,close(){}});
async function parse(name){
 const bytes=fs.readFileSync('dist/assets/models/'+name+'.glb');
 return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
}

const file=await parse('beluga'),character=file.scene;
const motion=new CharacterMotion(character,file.animations,{random:()=>.5});
const wardrobe=new WardrobeAssets(character,{loadAsync:url=>parse(url.split('/').at(-1).split('.')[0])});
await wardrobe.apply({...DEFAULT_STATE,outfit:'moonlight',top:null,bottom:null,extras:[]});
const skin=[];character.traverse(mesh=>{if(mesh.isSkinnedMesh&&mesh.material.name.startsWith('base_primary'))skin.push(mesh)});
const discarded=captureCoverage(skin[0].material);

const ray=new T.Ray(new T.Vector3(),new T.Vector3(0,0,-1));
const a=new T.Vector3(),b=new T.Vector3(),q=new T.Vector3(),bary=new T.Vector3();
const fixtures=[
 [.39244,2.22588],[-.39244,2.22588],[.38089,2.24574],[-.38089,2.24574],[.39573,2.32519],[-.39573,2.32519],
 // Include the upper boundary of the central torso mask as well as the
 // lower elliptical cutout. Fabric-covered samples are excluded below.
 ...[.350,.365,.385,.395].flatMap(x=>[2.300,2.335,2.360].flatMap(y=>[[x,y],[-x,y]])),
 // Visually confirmed upper neckline notches, seen from the front. These
 // sit inward of the arm-weight cutoff and require a camera-facing probe.
 [-.3284,2.4314,.2549],[.3088,2.4157,.2627],
];
const anchors=fixtures.map(([x,y,frontReference])=>{
 ray.origin.set(x,y,2);let distance=Infinity,best;
 for(const mesh of skin){
  const p=mesh.geometry.attributes.position,idx=mesh.geometry.index,arms=mesh.geometry.attributes.wardrobeArm;
  for(let i=0;i<idx.count;i+=3){
   const ids=[idx.getX(i),idx.getX(i+1),idx.getX(i+2)];
   a.fromBufferAttribute(p,ids[0]);b.fromBufferAttribute(p,ids[1]);q.fromBufferAttribute(p,ids[2]);
   if(x<Math.min(a.x,b.x,q.x)||x>Math.max(a.x,b.x,q.x)||y<Math.min(a.y,b.y,q.y)||y>Math.max(a.y,b.y,q.y))continue;
   const hit=ray.intersectTriangle(a,b,q,true,new T.Vector3());
   if(hit&&ray.origin.distanceTo(hit)<distance){
    distance=ray.origin.distanceTo(hit);T.Triangle.getBarycoord(hit,a,b,q,bary);
    const arm=ids.reduce((n,index,j)=>n+arms.getX(index)*bary.getComponent(j),0);
    best={mesh,ids,bary:bary.clone(),rest:hit.clone(),arm,frontView:frontReference!==undefined};
   }
  }
 }
 assert(best,`front skin fixture exists at ${x},${y}`);return best;
});
const clothTriangles=[];
for(const mesh of wardrobe.loaded.get('moonlight').meshes){
 const p=mesh.geometry.attributes.position,idx=mesh.geometry.index;
 for(let i=0;i<idx.count;i+=3){
  const ids=[idx.getX(i),idx.getX(i+1),idx.getX(i+2)];
  const ys=ids.map(j=>p.getY(j)),zs=ids.map(j=>p.getZ(j));
  if(Math.max(...ys)>=2.12&&Math.min(...ys)<=2.5&&Math.max(...zs)>0)clothTriangles.push({mesh,ids});
 }
}
function posed(mesh,index){return mesh.getVertexPosition(index,new T.Vector3()).applyMatrix4(mesh.matrixWorld)}
function step(){motion.update(1/60);wardrobe.update(1/60,motion);character.updateMatrixWorld(true);for(const mesh of [...skin,...wardrobe.loaded.get('moonlight').meshes])mesh.skeleton.update()}
const normal=new T.Vector3(),center=new T.Vector3(),edge=new T.Vector3(),hit=new T.Vector3();
const report=[];let exposedSamples=0;
for(const action of ['relaxed','wave','dance','tada']){
 motion.setPose('relaxed');for(let frame=0;frame<300;frame++)step();
 if(action==='tada')motion.setPose(action);else if(action!=='relaxed')motion.play(action);
 let visible=0,covered=0;
 for(let frame=0;frame<180;frame++){
  step();if(frame%30)continue;const cache=new Map();
  function clothPoint(mesh,index){let points=cache.get(mesh);if(!points){points=new Map();cache.set(mesh,points)}if(!points.has(index))points.set(index,posed(mesh,index));return points.get(index)}
  for(const anchor of anchors){
   const triangle=anchor.ids.map(index=>posed(anchor.mesh,index));
   center.set(0,0,0);for(let j=0;j<3;j++)center.addScaledVector(triangle[j],anchor.bary.getComponent(j));
   normal.subVectors(triangle[1],triangle[0]).cross(edge.subVectors(triangle[2],triangle[0])).normalize();
   if(anchor.frontView){assert(normal.z>0,'neckline fixture remains front-facing');normal.set(0,0,1)}
   ray.origin.copy(center).addScaledVector(normal,.15);ray.direction.copy(normal).negate();
   let fabric=false;
   for(const tri of clothTriangles){
    if(ray.intersectTriangle(...tri.ids.map(index=>clothPoint(tri.mesh,index)),true,hit)&&ray.origin.distanceTo(hit)<.15){fabric=true;break}
   }
   if(fabric){covered++;continue}
   const masked=discarded(anchor.rest,anchor.arm);
   assert(!masked,`${action} frame ${frame}: exposed armhole skin is discarded with no covering dress at ${anchor.rest.toArray()} (arm weight ${anchor.arm})`);
   visible++;exposedSamples++;
  }
 }
 report.push({action,visible,covered});
}
assert(exposedSamples>=12,'fixtures exercise the actual open armholes, not only covered fabric');
console.log(JSON.stringify({status:'PASS',fixtures:anchors.map(({rest,arm,frontView})=>({rest:rest.toArray(),arm,frontView})),report,exposedSamples},null,2));
