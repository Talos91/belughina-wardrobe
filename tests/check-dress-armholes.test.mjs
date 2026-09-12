import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as T from 'three';
import {MeshoptDecoder} from '../dist/vendor/libs/meshopt_decoder.module.js';
import {GLTFLoader} from '../dist/vendor/loaders/GLTFLoader.js';
import {WardrobeAssets,fitWardrobeSkin} from '../dist/wardrobe-assets.js';
import {CharacterMotion} from '../dist/character-motion.js';
import {TailGrounding} from '../dist/tail-grounding.js';
import {DEFAULT_STATE} from '../dist/wardrobe-state.js';
import {captureCoverage} from './wardrobe-coverage-probe.mjs';

globalThis.self=globalThis;
globalThis.createImageBitmap=async()=>({width:2048,height:2048,close(){}});
const root='dist/assets/models/';
async function parse(file){
 const override=process.env.WARDROBE_TEST_MODELS&&path.join(process.env.WARDROBE_TEST_MODELS,file);
 const bytes=fs.readFileSync(override&&fs.existsSync(override)?override:root+file);
 return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
}
const file=await parse('beluga.glb'),character=file.scene;
const motion=new CharacterMotion(character,file.animations,{random:()=>.5});
const grounding=new TailGrounding(character);
const wardrobe=new WardrobeAssets(character,{loadAsync:url=>parse(url.split('/').at(-1).split('?')[0])});
const skin=[];
character.traverse(m=>{if(m.isSkinnedMesh&&m.material.name.startsWith('base_primary'))skin.push(m)});
const a=new T.Vector3(),b=new T.Vector3(),q=new T.Vector3();

function nearest(point,meshes){
 let distance=Infinity,best;
 for(const mesh of meshes){
  const position=mesh.geometry.attributes.position;
  for(let i=0;i<position.count;i++){
   a.fromBufferAttribute(position,i);const d=a.distanceToSquared(point);
   if(d<distance){distance=d;best=[mesh,i]}
  }
 }
 assert(best,'landmark has a matching mesh vertex');return best;
}
function posed([mesh,index],target){return mesh.getVertexPosition(index,target).applyMatrix4(mesh.matrixWorld)}
function step(){
 motion.update(1/60);grounding.update(motion);wardrobe.update(1/60,motion);
 character.updateMatrixWorld(true);
 for(const mesh of skin)mesh.skeleton.update();
 for(const id of wardrobe.shown)for(const mesh of wardrobe.loaded.get(id).meshes)mesh.skeleton.update();
}
function start(action){
 motion.setPose('relaxed');for(let frame=0;frame<300;frame++)step();
 if(action==='tada')motion.setPose(action);else motion.play(action);
}

// These are visible armhole/sleeve joins, distinct from the high neck ties
// already covered by check-wearable-connections. Before the fit, a raised arm
// pulled away from the adjacent dress by 0.04–0.11 world units at these joins.
const report=[];
for(const id of ['pink','bloom','floral']){
 await wardrobe.apply({...DEFAULT_STATE,outfit:id,top:null,bottom:null,extras:[]});
 const landmarks=id==='floral'?[[.55,2.45,.08],[-.55,2.45,.08]]:[[.395,2.245,.125],[-.395,2.245,.125]];
 const pairs=landmarks.map(xyz=>{
  const body=nearest(new T.Vector3(...xyz),skin);
  q.fromBufferAttribute(body[0].geometry.attributes.position,body[1]);
  const garment=nearest(q,wardrobe.loaded.get(id).meshes);
  a.fromBufferAttribute(garment[0].geometry.attributes.position,garment[1]);
  assert(body[0].geometry.attributes.wardrobeArm.getX(body[1])>=.30,'armhole anchor is exposed arm skin');
  return {body,garment,rest:a.distanceTo(q),maxGap:0,maxDrift:0};
 });
 for(const carrying of [false,true]){
  character.userData.carryingTote=carrying;
  for(const action of ['wave','dance','tada']){
   start(action);
   for(let frame=0;frame<240;frame++){
    step();if(frame%6)continue;
    for(const pair of pairs){
     const gap=posed(pair.body,a).distanceTo(posed(pair.garment,b));
     pair.maxGap=Math.max(pair.maxGap,gap);pair.maxDrift=Math.max(pair.maxDrift,Math.abs(gap-pair.rest));
     // Outfit fitting must never achieve clearance by changing this exposed
     // arm. The rendered/CPU body point equals the untouched skinning result.
     const [mesh,index]=pair.body;
     mesh.getVertexPosition(index,a);T.SkinnedMesh.prototype.getVertexPosition.call(mesh,index,b);
     assert(a.distanceTo(b)<1e-7,`${id}: exposed arm shape changed`);
    }
   }
  }
 }
 for(const pair of pairs){
  assert(pair.maxDrift<.035,`${id}: armhole separates from its skin support (${pair.maxDrift})`);
  assert(pair.maxGap<.065,`${id}: armhole gap exceeds fabric ease (${pair.maxGap})`);
 }
 report.push({id,anchors:pairs.map(({rest,maxGap,maxDrift})=>({rest,maxGap,maxDrift}))});
}

// A hidden body can reveal the FRONT lining through a missing back panel.
// Test actual outward-facing rear fabric at the reported white back patches,
// then carry the same body-triangle fixtures through the raised-arm motions.
await wardrobe.apply({...DEFAULT_STATE,outfit:'moonlight',top:null,bottom:null,extras:[]});
// Restoring the open armhole also requires a small inward fit where lower
// arm-root skin intersects the bodice. Keep that fit local and continuous.
// Compare with the existing ordinary torso fit; visible surface rays are
// tested separately in check-moonlight-visible-skin.
function lowerArmRoot(point){
 return Math.abs(point.x)>.15&&Math.abs(point.x)<.48&&point.y>2.10&&point.y<2.36&&point.z>0&&point.z<.39;
}
const fitSafety={changedVertices:0,protectedVertices:0,affectedTriangles:0,concealedNormalReversals:0,unmaskedNormalReversals:0,maximumDisplacement:0,minimumVisibleNormalDot:1};
const moonlightDiscarded=captureCoverage(skin[0].material);
for(const mesh of skin){
 const p=mesh.geometry.attributes.position,arms=mesh.geometry.attributes.wardrobeArm,idx=mesh.geometry.index;
 const ordinary=[],moonlight=[],changed=new Uint8Array(p.count);
 for(let index=0;index<p.count;index++){
  const rest=new T.Vector3().fromBufferAttribute(p,index),arm=arms.getX(index);
  const before=fitWardrobeSkin(rest.clone(),arm,true,false,false,false);
  const after=fitWardrobeSkin(rest.clone(),arm,true,false,false,true);
  const displacement=before.distanceTo(after);
  assert(Number.isFinite(displacement),'Moonlight fit remains finite');
  assert.equal(after.y,before.y,'local arm-root fitting preserves body height');
  assert(displacement<=Math.SQRT2*.045+1e-7,'Moonlight lower arm-root inset is bounded');
  if(!lowerArmRoot(rest)){
   assert(displacement<1e-7,'Moonlight must preserve upper/open arms and distal flippers');
   fitSafety.protectedVertices++;
  }
  if(displacement>1e-7){changed[index]=1;fitSafety.changedVertices++}
  fitSafety.maximumDisplacement=Math.max(fitSafety.maximumDisplacement,displacement);
  ordinary.push(before);moonlight.push(after);
 }
 const beforeNormal=new T.Vector3(),afterNormal=new T.Vector3(),edge1=new T.Vector3(),edge2=new T.Vector3();
 for(let i=0;i<idx.count;i+=3){
  const ids=[idx.getX(i),idx.getX(i+1),idx.getX(i+2)];
  if(!ids.some(index=>changed[index]))continue;
  const original=ids.map(index=>ordinary[index]),fitted=ids.map(index=>moonlight[index]);
  beforeNormal.subVectors(original[1],original[0]).cross(edge1.subVectors(original[2],original[0]));
  afterNormal.subVectors(fitted[1],fitted[0]).cross(edge2.subVectors(fitted[2],fitted[0]));
  if(beforeNormal.lengthSq()<1e-16)continue;
  const dot=beforeNormal.clone().normalize().dot(afterNormal.clone().normalize());
  const restTriangle=ids.map(index=>new T.Vector3().fromBufferAttribute(p,index));
  const centroid=restTriangle.reduce((sum,point)=>sum.add(point),new T.Vector3()).multiplyScalar(1/3);
  const whollyMasked=ids.every((index,j)=>moonlightDiscarded(restTriangle[j],arms.getX(index)))
   &&moonlightDiscarded(centroid,ids.reduce((sum,index)=>sum+arms.getX(index),0)/3);
  if(whollyMasked){if(dot<=0)fitSafety.concealedNormalReversals++}
  else{
   // Quantized mesh simplification creates thin slivers whose face normals
   // can reverse under a smooth fit. Keep this diagnostic; visibility rays
   // distinguish a real open-surface defect from hidden/subpixel triangles.
   if(dot<=0)fitSafety.unmaskedNormalReversals++;
   fitSafety.minimumVisibleNormalDot=Math.min(fitSafety.minimumVisibleNormalDot,dot);
  }
  fitSafety.affectedTriangles++;
 }
}
assert(fitSafety.protectedVertices>1000,'upper body and flipper protection uses actual model vertices');
// Dense cross-sections guard the transition into untouched skin independently
// of mesh tessellation. Adjacent 0.5 mm samples cannot make a millimetre jump.
for(const axis of ['x','y','z'])for(const sign of [-1,1]){
 let previous=null;
 const low=axis==='x'?.10:axis==='y'?2.05:-.02,high=axis==='x'?.52:axis==='y'?2.42:.43;
 for(let value=low;value<=high;value+=.0005){
  const point=new T.Vector3(sign*.3775,2.21,.2784);point[axis]=axis==='x'?sign*value:value;
  const offset=fitWardrobeSkin(point.clone(),.20,true,false,false,true).sub(fitWardrobeSkin(point.clone(),.20,true,false,false,false));
  if(previous)assert(offset.distanceTo(previous)<.001,'Moonlight inset joins the surrounding skin continuously');
  previous=offset;
 }
}
const fixtures=[
 ...[[-.113,2.400],[-.181,2.431],[-.230,2.416],[-.279,2.431]].map(xy=>({side:'rear',xyz:xy})),
 // These front-skin facets were visible from inside/back while the body
 // rendered both sides. Preserve the open armhole and reject that ghost skin.
 ...[[.39244,2.22588,.21668],[-.39244,2.22588,.21668],[.39573,2.32519,.25527],[-.39573,2.32519,.25527]].map(xyz=>({side:'front',xyz})),
];
const ray=new T.Ray(new T.Vector3(),new T.Vector3(0,0,1));
const bary=new T.Vector3();
const anchors=fixtures.map(({side,xyz:[x,y,expectedZ]})=>{
 const sign=side==='front'?1:-1;
 ray.origin.set(x,y,sign*2);ray.direction.set(0,0,-sign);let depth=Infinity,fixture=null;
 for(const mesh of skin){
  const p=mesh.geometry.attributes.position,idx=mesh.geometry.index;
  for(let i=0;i<idx.count;i+=3){
   const ids=[idx.getX(i),idx.getX(i+1),idx.getX(i+2)];
   a.fromBufferAttribute(p,ids[0]);b.fromBufferAttribute(p,ids[1]);q.fromBufferAttribute(p,ids[2]);
   if(x<Math.min(a.x,b.x,q.x)||x>Math.max(a.x,b.x,q.x)||y<Math.min(a.y,b.y,q.y)||y>Math.max(a.y,b.y,q.y))continue;
   const hit=ray.intersectTriangle(a,b,q,true,new T.Vector3());
   if(hit&&ray.origin.distanceTo(hit)<depth){depth=ray.origin.distanceTo(hit);T.Triangle.getBarycoord(hit,a,b,q,bary);fixture={side,mesh,ids,bary:bary.clone(),rest:[x,y,hit.z]}}
  }
 }
 assert(fixture,`${side} body fixture exists at ${x},${y}`);
 if(expectedZ!==undefined)assert(Math.abs(fixture.rest[2]-expectedZ)<.035,`${side} ray stays on the reported armhole skin patch`);
 return fixture;
});
const rearTriangles=[];
for(const mesh of wardrobe.loaded.get('moonlight').meshes){
 const p=mesh.geometry.attributes.position,idx=mesh.geometry.index;
 for(let i=0;i<idx.count;i+=3){
  const ids=[idx.getX(i),idx.getX(i+1),idx.getX(i+2)];
  const ys=ids.map(j=>p.getY(j)),zs=ids.map(j=>p.getZ(j));
  if(Math.max(...ys)>=2.25&&Math.min(...ys)<=2.85&&Math.min(...zs)<0)rearTriangles.push({mesh,ids});
 }
}
assert(rearTriangles.length,'Moonlight has real rear bodice geometry');
let minimumBackClearance=Infinity,maximumBackClearance=0;
let insideFacetsCulled=0,doubleSidedControls=0;
const normal=new T.Vector3(),center=new T.Vector3(),edge=new T.Vector3(),hit=new T.Vector3();
// Isolate the particular real body facet, using its production material and
// actual deformed vertices. This avoids counting another legitimate surface
// nearby and keeps a high-detail whole-body raycast out of this targeted test.
const facetGeometry=new T.BufferGeometry();
facetGeometry.setAttribute('position',new T.BufferAttribute(new Float32Array(9),3));
const facet=new T.Mesh(facetGeometry),insideRay=new T.Raycaster();
insideRay.near=0;insideRay.far=.04;
for(const action of ['wave','dance','tada']){
 start(action);
 for(let frame=0;frame<180;frame++){
  step();if(frame%15)continue;
  const cache=new Map();
  function garmentPoint(mesh,index){
   let vertices=cache.get(mesh);if(!vertices){vertices=new Map();cache.set(mesh,vertices)}
   if(!vertices.has(index))vertices.set(index,posed([mesh,index],new T.Vector3()));
   return vertices.get(index);
  }
  for(const fixture of anchors){
   if(fixture.side==='front')for(const index of fixture.ids){
    if(fixture.mesh.geometry.attributes.wardrobeArm.getX(index)<.30)continue;
    q.fromBufferAttribute(fixture.mesh.geometry.attributes.position,index);
    if(lowerArmRoot(q))continue;
    fixture.mesh.getVertexPosition(index,a);T.SkinnedMesh.prototype.getVertexPosition.call(fixture.mesh,index,b);
    assert(a.distanceTo(b)<1e-7,'Moonlight must not reshape upper/open arms outside the lower bodice fit');
   }
   const triangle=fixture.ids.map(i=>posed([fixture.mesh,i],new T.Vector3()));
   center.set(0,0,0);for(let j=0;j<3;j++)center.addScaledVector(triangle[j],fixture.bary.getComponent(j));
   normal.subVectors(triangle[1],triangle[0]).cross(edge.subVectors(triangle[2],triangle[0])).normalize();
   if(fixture.side==='front'){
    const positions=facetGeometry.attributes.position;
    for(let j=0;j<3;j++)positions.setXYZ(j,triangle[j].x,triangle[j].y,triangle[j].z);
    positions.needsUpdate=true;facetGeometry.computeBoundingSphere();
    facet.material=fixture.mesh.material;
    insideRay.ray.origin.copy(center).addScaledVector(normal,-.015);
    insideRay.ray.direction.copy(normal);
    assert.equal(insideRay.intersectObject(facet,false).length,0,`${action} frame ${frame}: arm interior backface is visible at ${fixture.rest}`);
    insideFacetsCulled++;
    if(action==='wave'&&frame===0){
     const previousSide=facet.material.side;
     try{
      facet.material.side=T.DoubleSide;
      assert(insideRay.intersectObject(facet,false).length>0,'DoubleSide control must reproduce the same visible interior facet');
      doubleSidedControls++;
     }finally{facet.material.side=previousSide}
    }
    continue;
   }
   ray.origin.copy(center).addScaledVector(normal,.16);ray.direction.copy(normal).negate();
   let closest=Infinity;
   for(const tri of rearTriangles){
    const vertices=tri.ids.map(i=>garmentPoint(tri.mesh,i));
    if(ray.intersectTriangle(...vertices,true,hit)){
     const d=ray.origin.distanceTo(hit);if(d<closest)closest=d;
    }
   }
   const clearance=.16-closest;
   assert(clearance>.006,`${action}: Moonlight ${fixture.side} fabric missing/inside body at ${fixture.rest} (clearance ${clearance})`);
   assert(clearance<.11,`${action}: Moonlight ${fixture.side} fabric floats away from skin (${clearance})`);
   minimumBackClearance=Math.min(minimumBackClearance,clearance);maximumBackClearance=Math.max(maximumBackClearance,clearance);
  }
 }
}
facetGeometry.dispose();
console.log(JSON.stringify({status:'PASS',report,moonlight:{rearFixtures:4,insideArmFixtures:4,minimumBackClearance,maximumBackClearance,insideFacetsCulled,doubleSidedControls,fitSafety}},null,2));
