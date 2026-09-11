import {MeshoptDecoder} from '../dist/vendor/libs/meshopt_decoder.module.js';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as T from 'three';
import {GLTFLoader} from '../dist/vendor/loaders/GLTFLoader.js';
import {CharacterMotion} from '../dist/character-motion.js';
import {CharacterPicker} from '../dist/character-picker.js';
import {TailGrounding} from '../dist/tail-grounding.js';
globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:2048,height:2048,close(){}});
const b=fs.readFileSync('dist/assets/models/beluga.glb');
const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
const c=gltf.scene,m=new CharacterMotion(c,gltf.animations,{random:()=>.43}),g=new TailGrounding(c),picker=new CharacterPicker(c);
const bones=[];c.traverse(o=>{if(o.isBone)bones.push(o);if(o.isMesh)o.raycast=()=>{throw new Error('Detailed mesh raycast must never run on tap')}});
const tick=(n=1,dt=1/60)=>{for(let i=0;i<n;i++){m.update(dt);g.update(m);for(const b of bones){assert(b.position.toArray().every(Number.isFinite));assert(Math.abs(b.quaternion.length()-1)<.00001, b.name+' q='+b.quaternion.length()+' action='+m.current?.type+' gentle='+m.gentle);}assert(g.lift<.23);}};
tick(180);const resting=c.getObjectByName('ArmR').quaternion.clone();
m.setPose('little');tick(240);assert(resting.angleTo(c.getObjectByName('ArmR').quaternion)>.28,'Little pose must visibly raise the free flipper');
tick(900);assert.equal(m.selectedPose,'little');assert(m.poseLayers[0].action.getEffectiveWeight()>.99);
m.play('boop');tick(240);assert.equal(m.current,null);assert.equal(m.layers.length,0);assert(m.poseLayers[0].action.getEffectiveWeight()>.99,'Return to selected pose after nose tap');
const idleTime=m.idle.time;tick(120);assert.notEqual(m.idle.time,idleTime,'Idle keeps running');
for(const carried of [false,true])for(const gentle of [false,true]){
 c.userData.carryingTote=carried;m.setGentle(gentle);
 for(const action of ['wave','kiss','wiggle','twirl','boop','pose','dress']){m.play(action);tick(80);m.play('boop');tick(18);m.play(action);tick(420);assert.equal(m.current,null);assert.equal(m.layers.length,0);}
 m.setPose('tada');tick(150);const held=bones.map(b=>({q:b.quaternion.clone(),p:b.position.clone()}));
 tick(100,0);bones.forEach((b,i)=>{assert(b.position.distanceTo(held[i].p)<.00001,'No accumulated grounding: '+b.name);assert(b.quaternion.clone().normalize().angleTo(held[i].q.clone().normalize())<.00001,'No accumulated pose: '+b.name);});
}
const reactions=Array.from({length:20},()=>{m.play('dress');const type=m.current.type;tick(300);return type});
for(let i=0;i<20;i+=4)assert.equal(new Set(reactions.slice(i,i+4)).size,4);
for(let i=1;i<20;i++)assert.notEqual(reactions[i],reactions[i-1]);
m.setGentle(false);m.setPose('relaxed');c.userData.carryingTote=false;tick(180);
const camera=new T.PerspectiveCamera(35,1,.1,100);camera.position.set(0,2.1,8);camera.lookAt(0,2.1,0);camera.updateMatrixWorld(true);
const head=c.getObjectByName('Head').getWorldPosition(new T.Vector3());head.y+=.24;head.z+=.5;
const headNdc=head.clone().project(camera);assert.equal(picker.pick(headNdc,camera),'boop');assert.equal(picker.pick(new T.Vector2(.99,.99),camera),null);
const start=performance.now();for(let i=0;i<1000;i++)picker.pick(headNdc,camera);const pickMs=performance.now()-start;assert(pickMs<2000,'Tap picking too slow');
console.log(JSON.stringify({status:'PASS',poses:'Held / blend back after actions',reactions:new Set(reactions).size,repeatedInterruptedActions:28,pausedFrames:400,analyticPicks:1000,pickMs:Math.round(pickMs)},null,2));
