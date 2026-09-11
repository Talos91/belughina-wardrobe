import {MeshoptDecoder} from '../dist/vendor/libs/meshopt_decoder.module.js';
import fs from 'node:fs';import assert from 'node:assert/strict';import * as T from 'three';
import {GLTFLoader} from '../dist/vendor/loaders/GLTFLoader.js';
import {WardrobeAssets} from '../dist/wardrobe-assets.js';
import {DEFAULT_STATE} from '../dist/wardrobe-state.js';
import {CharacterMotion} from '../dist/character-motion.js';
import {SalamiSummon} from '../dist/salami-summon.js';
globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:2048,height:2048,close(){}});
async function parse(name){const b=fs.readFileSync('dist/assets/models/'+name+'.glb');return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')}
const file=await parse('beluga'),scene=new T.Scene();scene.add(file.scene);const wardrobe=new WardrobeAssets(file.scene,{loadAsync:async url=>parse(url.split('/').at(-1).split('.')[0])});
const motion=new CharacterMotion(file.scene,file.animations,{random:()=>.5});let landings=0;const summon=new SalamiSummon(scene,wardrobe,{onLand:()=>landings++,visual:(await parse('salami')).scene});
assert.equal(summon.summon(),false);
await wardrobe.apply({...DEFAULT_STATE,extras:['tote']});summon.setEquipped(true);assert(summon.summon());assert.equal(summon.summon(),false);
const start=summon.root.position.clone();
for(let frame=0;frame<180;frame++){motion.update(1/60);wardrobe.update(1/60,motion);summon.update(1/60);assert(summon.root.position.toArray().every(Number.isFinite))}
console.log({start:start.toArray(),landed:summon.root.position.toArray(),target:summon.target.toArray(),scale:summon.root.scale.toArray(),phase:summon.phase});
assert.equal(landings,1);assert.equal(summon.phase,'peeking');assert(start.y-summon.root.position.y>2);assert(summon.root.position.distanceTo(summon.target)<.001);
motion.play('twirl');for(let frame=0;frame<90;frame++){motion.update(1/60);wardrobe.update(1/60,motion);summon.update(1/60);assert(summon.root.position.distanceTo(summon.target)<.001)}
assert(summon.summon({gentle:true}));for(let frame=0;frame<50;frame++)summon.update(1/60);assert.equal(landings,2);
summon.setEquipped(false);assert.equal(summon.root.visible,false);assert.equal(summon.phase,'hidden');assert.equal(summon.summon(),false);
await wardrobe.apply({...DEFAULT_STATE,extras:[]});summon.setEquipped(true);summon.summon();assert.equal(summon.root.visible,false);
console.log('PASS: bag required; one salami; drop and attachment; repeat; gentle motion; bag removal');
