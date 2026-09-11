import {MeshoptDecoder} from '../dist/vendor/libs/meshopt_decoder.module.js';
import fs from 'node:fs';import assert from 'node:assert/strict';
import {GLTFLoader} from '../dist/vendor/loaders/GLTFLoader.js';
import {WardrobeAssets} from '../dist/wardrobe-assets.js';
import {DEFAULT_STATE} from '../dist/wardrobe-state.js';
import {CharacterMotion} from '../dist/character-motion.js';
globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:2048,height:2048,close(){}});
const parse=async name=>{const b=fs.readFileSync('dist/assets/models/'+name+'.glb');return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')};
const file=await parse('beluga'),motion=new CharacterMotion(file.scene,file.animations,{random:()=>.5});
const wardrobe=new WardrobeAssets(file.scene,{loadAsync:async url=>parse(url.split('/').at(-1).split('.')[0])});
const combinations=[];
for(const bottom of [null,'shorts','trousers','satin'])for(const top of [null,'stripe','halter','noir'])combinations.push({outfit:'base',bottom,top});
for(const outfit of ['bloom','pink','floral','moonlight'])combinations.push({outfit,top:null,bottom:null});
for(const combination of combinations){
 const state={...DEFAULT_STATE,...combination,extras:['wrap']};assert(await wardrobe.apply(state));
 const layer=state.outfit!=='base'?state.outfit:state.bottom?state.bottom+(state.top?'_'+state.top:''):state.top||'base';
 for(const mesh of wardrobe.loaded.get('wrap').meshes){assert.equal(mesh.morphTargetInfluences[mesh.morphTargetDictionary['Layer_'+layer]],1);assert.equal(mesh.morphTargetInfluences.reduce((a,b)=>a+b,0),1)}
 motion.play('twirl');
 for(let n=0;n<45;n++){motion.update(1/60);wardrobe.update(1/60,motion);const beneath=wardrobe.loaded.get(state.outfit!=='base'?state.outfit:state.bottom)?.cloth;if(beneath)assert.deepEqual(wardrobe.loaded.get('wrap').cloth.sections.map(v=>v.toArray()),beneath.sections.map(v=>v.toArray()))}
}
console.log('PASS: all 20 wrap combinations select their fitted layer and follow the underlying cloth.');
