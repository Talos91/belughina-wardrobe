import {MeshoptDecoder} from '../dist/vendor/libs/meshopt_decoder.module.js';
import fs from 'node:fs';import assert from 'node:assert/strict';import * as T from 'three';
import {GLTFLoader} from '../dist/vendor/loaders/GLTFLoader.js';
import {WardrobeAssets,fitWardrobeSkin} from '../dist/wardrobe-assets.js';
import {DEFAULT_STATE} from '../dist/wardrobe-state.js';
import {CharacterMotion} from '../dist/character-motion.js';
import {TailGrounding} from '../dist/tail-grounding.js';
globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:2048,height:2048,close(){}});
const root='dist/assets/models/';
async function parse(path){const b=fs.readFileSync(path);return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')}
const file=await parse(root+'beluga.glb'),character=file.scene;
const motion=new CharacterMotion(character,file.animations,{random:()=>.5}),ground=new TailGrounding(character);
const wardrobe=new WardrobeAssets(character,{loadAsync:url=>parse(root+url.split('/').at(-1).split('?')[0])});
const skin=[];character.traverse(m=>{if(m.isSkinnedMesh&&m.material.name.startsWith('base_primary'))skin.push(m)});
const a=new T.Vector3(),b=new T.Vector3();
const protectedPoints=[];
for(const m of skin){const {position,wardrobeArm}=m.geometry.attributes;for(let i=0;i<position.count;i+=211){a.fromBufferAttribute(position,i);if(a.y>=2.35||a.y<=.80||wardrobeArm.getX(i)>=.30){assert.deepEqual(fitWardrobeSkin(a.clone(),wardrobeArm.getX(i),true).toArray(),a.toArray());protectedPoints.push([m,i]);}}}
function nearest(point,meshes){let d=Infinity,best;for(const m of meshes){const p=m.geometry.attributes.position;for(let i=0;i<p.count;i++){b.fromBufferAttribute(p,i);const q=b.distanceToSquared(point);if(q<d){d=q;best=[m,i]}}}return {pair:best,d:Math.sqrt(d)}}
function pos([m,i],p){m.skeleton.update();return m.getVertexPosition(i,p).applyMatrix4(m.matrixWorld)}
const report=[];
for(const id of ['pink','bloom','halter','tote']){
 const state={...DEFAULT_STATE,extras:id==='tote'?['tote']:[],outfit:['pink','bloom'].includes(id)?id:'base',top:id==='halter'?'halter':null,bottom:id==='halter'?'trousers':null};
 await wardrobe.apply(state);const item=wardrobe.loaded.get(id);const pairs=[];
 if(id==='pink'){
  const ties=item.meshes.filter(m=>m.material.name.includes('ties')),bodice=item.meshes.filter(m=>!ties.includes(m));
  for(const m of ties){const p=m.geometry.attributes.position;for(let i=0;i<p.count;i+=4)if(p.getY(i)<2.335){a.fromBufferAttribute(p,i);const n=nearest(a,bodice);pairs.push({a:[m,i],b:n.pair,rest:n.d})}}
 }else{
  for(const m of item.meshes){const p=m.geometry.attributes.position;let added=0;for(let i=0;i<p.count;i+=7)if(p.getY(i)>(id==='tote'?2.63:2.79)){a.fromBufferAttribute(p,i);const n=nearest(a,skin);pairs.push({a:[m,i],b:n.pair,rest:n.d});if(++added>=24)break}}
 }
 assert(pairs.length>0,id+' has no attachment samples');
 let maxGap=0,maxDrift=0,maxSkinChange=0;
 for(let f=0;f<980;f++){
  if(f===0)motion.play('wave');if(f===120)motion.play('twirl');if(f===310)motion.play('wiggle');if(f===430)motion.play('dance');if(f===610)motion.play('love');if(f===790)motion.play('camera');
  motion.update(1/60);ground.update(motion);wardrobe.update(1/60,motion);
  if(f%6)continue;
  for(const pair of pairs){const d=pos(pair.a,a).distanceTo(pos(pair.b,b));maxGap=Math.max(maxGap,d);maxDrift=Math.max(maxDrift,Math.abs(d-pair.rest));}
  for(const [m,i] of protectedPoints){m.skeleton.update();m.getVertexPosition(i,a);T.SkinnedMesh.prototype.getVertexPosition.call(m,i,b);maxSkinChange=Math.max(maxSkinChange,a.distanceTo(b));}
 }
 report.push({id,samples:pairs.length,maxGap,maxDrift,maxSkinChange});
 assert(maxSkinChange<1e-7,id+' changes exposed anatomy');
 assert(maxGap<.12,id+' detached connection '+maxGap);
 assert(maxDrift<.065,id+' attachment drift '+maxDrift);
}
console.log(JSON.stringify({status:'PASS',protectedPoints:protectedPoints.length,report},null,2));
