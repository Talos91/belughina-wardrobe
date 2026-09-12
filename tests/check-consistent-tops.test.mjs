import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Vector3,FrontSide} from 'three';
import {GLTFLoader} from '../dist/vendor/loaders/GLTFLoader.js';
import {MeshoptDecoder} from '../dist/vendor/libs/meshopt_decoder.module.js';
import {WardrobeAssets} from '../dist/wardrobe-assets.js';
import {DEFAULT_STATE,sanitizeState,equipClothing,openingState,PLACES} from '../dist/wardrobe-state.js';

globalThis.self=globalThis;
globalThis.createImageBitmap=async()=>({width:1024,height:1024,close(){}});
const parse=async id=>{
 const b=fs.readFileSync(`dist/assets/models/${id}.glb`);
 return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
};
const {scene}=await parse('beluga');
const wardrobe=new WardrobeAssets(scene,{loadAsync:url=>parse(url.split('/').at(-1).split('.')[0])});
const positions=item=>item.meshes.map(mesh=>{
 const output=[],v=new Vector3();
 for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,v);output.push(v.clone());}
 return output;
});
for(const bottom of ['shorts','trousers','satin']){
 const state={...DEFAULT_STATE,top:'stripe',bottom,extras:[]};
 assert(await wardrobe.apply(state));
 const reference=positions(wardrobe.loaded.get(bottom));
 const next=equipClothing(state,'noir');assert.equal(next.bottom,bottom);
 assert(await wardrobe.apply(next));
 positions(wardrobe.loaded.get(bottom)).forEach((mesh,m)=>mesh.forEach((v,i)=>assert(v.distanceTo(reference[m][i])<.000008,`${bottom}: changing to the black top changed its silhouette`)));
}
assert(await wardrobe.apply({...DEFAULT_STATE,top:'halter',extras:[]}));
assert(wardrobe.loaded.get('halter').meshes.every(mesh=>mesh.material.side===FrontSide),'Cream lining must not render backwards through the cups');
const hem=id=>Math.min(...wardrobe.loaded.get(id).meshes.flatMap(mesh=>{const p=mesh.geometry.attributes.position;return Array.from({length:p.count},(_,i)=>p.getY(i))}));
assert(Math.abs(hem('noir')-hem('halter'))<.012,'Black waistband must finish at the same hem as the cream halter');
assert(await wardrobe.apply({...DEFAULT_STATE,outfit:'moonlight',extras:[]}));
assert(wardrobe.loaded.get('moonlight').meshes.every(mesh=>mesh.material.side===FrontSide),'Moonlight lining must not render backwards through the outer shell');
for(const [old,newRoom] of Object.entries({atelier:'bedroom',seaside:'resort',greenhouse:'villa',moonlit:'starlight',scrapbook:'bedroom',pastel:'starlight',tuscany:'villa'}))assert.equal(sanitizeState({...DEFAULT_STATE,place:old}).place,newRoom);
assert.equal(sanitizeState({...DEFAULT_STATE,pose:'tada'}).pose,'tada');
assert.equal(sanitizeState({...DEFAULT_STATE,pose:'camera'}).pose,'relaxed','Only persistent poses belong in saved looks');
console.log('PASS: all three bottoms retain the shirt silhouette under the black halter; Moonlight shell rendering and saved-room migration.');

const opening=openingState({...DEFAULT_STATE,outfit:'moonlight',extras:['tote'],place:'villa',colors:{base_primary:'#123456'},gentle:true});
assert.deepEqual([opening.outfit,opening.top,opening.bottom,opening.extras,opening.place,opening.colors],['base',null,null,[],'bedroom',{}]);
assert.equal(opening.gentle,true);assert.equal(PLACES.find(p=>p.id==='villa').name,'Tuscany Miraggio');
