import * as THREE from 'three';
import {attachMoonlightDress,installRibbonColors} from './moonlight-dress.js?v=gift-web-1';
import {SkirtDynamics} from './skirt-dynamics.js?v=gift-web-1';
import {activeItems} from './wardrobe-state.js?v=gift-web-1';

// CPU counterpart of the concealed torso insert, also used by picking and
// attachment checks. Exposed neck/shoulders, flippers and flukes are unchanged.
export function fitWardrobeSkin(point,arm,worn,bottomOnly=false,creamHalter=false){
 if(point.y>=2.35||point.y<=.80||arm>=.30)return point;
 const smooth=THREE.MathUtils.smoothstep;
 if(bottomOnly){
  const waist=smooth(point.y,1.45,1.80)*(1-smooth(point.y,1.86,2.30))*(1-smooth(arm,.08,.30));
  point.x*=1-.30*waist;point.z=.05+(point.z-.05)*(1-.35*waist);return point;
 }
 if(!worn)return point;
 const openChest=creamHalter?smooth(point.z,.08,.14)*smooth(point.y,2.14+Math.abs(point.x)*1.5,2.18+Math.abs(point.x)*1.5):0;
 const inset=smooth(point.y,.80,1.60)*(1-smooth(point.y,2.03,2.35))*(1-smooth(arm,.08,.30))*(1-openChest);
 point.x*=1-.24*inset;point.z=.14+(point.z-.14)*(1-.32*inset);return point;
}

// Garments share the character's existing bones. Only requested pieces are
// downloaded; superseded requests may warm the cache but cannot change a look.
export class WardrobeAssets{
 constructor(character,loader,{onLoading=()=>{},onError=()=>{}}={}){
  this.character=character;this.loader=loader;this.onLoading=onLoading;this.onError=onError;
  this.loaded=new Map();this.pending=new Map();this.request=0;this.state=null;this.shown=new Set();
  this.coverage=installWardrobeCoverage(character);
 }
 async load(id){
  if(this.loaded.has(id))return this.loaded.get(id);
  if(this.pending.has(id))return this.pending.get(id);
  const task=(async()=>{
   const file=await this.loader.loadAsync(`./assets/models/${id}.glb?v=gift-web-1`);
   const meshes=attachMoonlightDress(this.character,file.scene,'Wardrobe_'+id);
   const originals=new Map();for(const mesh of meshes){mesh.visible=false;for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])originals.set(m,m.color.clone());}
   // The scarf already includes its lining. Rendering both sides of each
   // shell lets the white underside show through its overlapping folds.
   if(id==='scarf')for(const mesh of meshes)mesh.material.side=THREE.FrontSide;
   const colors=id==='moonlight'?installRibbonColors(meshes):null;
   const tucked=['shorts','trousers','satin'].includes(id)?installBottomLayer(meshes):null;
   const strength={moonlight:1,pink:.85,floral:.75,bloom:.8,wrap:.16,trousers:.22,satin:.48,scarf:.16}[id];
   const cloth=strength?new SkirtDynamics(this.character,meshes,{strength}):null;
   const rest=id==='scarf'?meshes.map(mesh=>mesh.geometry.attributes.position.array.slice()):null;
   const item={id,meshes,originals,colors,cloth,tucked,rest,lastUsed:performance.now()};this.loaded.set(id,item);return item;
  })();
  this.pending.set(id,task);try{return await task}finally{this.pending.delete(id)}
 }
 async apply(state){
  this.state=state;const request=++this.request,ids=activeItems(state);
  this.reconcile();this.onLoading(ids.some(id=>!this.loaded.has(id)));
  const results=await Promise.allSettled(ids.map(id=>this.load(id)));
  if(request!==this.request){this.reconcile();return false;}
  this.reconcile();this.onLoading(false);
  if(results.some(r=>r.status==='rejected')){console.error(...results.filter(r=>r.status==='rejected').map(r=>r.reason));this.onError();return false;}
  this.trim();return true;
 }
 reconcile(){
  if(!this.state)return;const desired=new Set(activeItems(this.state));this.shown.clear();
  for(const [id,item] of this.loaded){
   const visible=desired.has(id);if(visible&&!item.meshes[0].visible)item.cloth?.reset();
   item.meshes.forEach(mesh=>{mesh.visible=visible});
   if(!visible)continue;this.shown.add(id);item.lastUsed=performance.now();
   if(id==='sunglasses')for(const mesh of item.meshes){const index=mesh.morphTargetDictionary?.Wear_forehead;if(index!==undefined)mesh.morphTargetInfluences[index]=this.state.glassesPosition==='forehead'?1:0;}
   if(id==='scarf'||id==='tote'||id==='wrap'||id==='trousers'||id==='shorts'||id==='satin')for(const mesh of item.meshes){
    // Fitted layer shapes preserve one original mesh and its texture layout.
    // The basket translates as a whole; shoulder handles stay supported.
    let layer=this.state.outfit!=='base'?this.state.outfit:this.state.top||this.state.bottom||'base';
    if(id==='wrap'&&this.state.outfit==='base'&&this.state.bottom)layer=this.state.bottom+(this.state.top?'_'+this.state.top:'');
    for(const [name,index] of Object.entries(mesh.morphTargetDictionary||{}))
     if(name.startsWith('Layer_'))mesh.morphTargetInfluences[index]=name==='Layer_'+layer?1:0;
   }
   if(item.tucked)item.tucked.value=desired.has('noir')?3:desired.has('halter')&&this.loaded.has('halter')?2:desired.has('stripe')&&this.loaded.has('stripe')?1:0;
   if(item.colors)item.colors.setColors(this.state.colors.moonlight_primary,this.state.colors.moonlight_secondary);
   else for(const [material,original] of item.originals){
    const tint=this.state.colors[id+'_primary'];
    material.color.copy(tint&&(id!=='sunglasses'||material.name.includes('_primary'))?new THREE.Color(tint):original);
   }
  }
  this.fitScarfLayers();
  this.character.userData.carryingTote=this.shown.has('tote');
  this.coverage.set(this.shown);
 }
 fitScarfLayers(){
  const scarf=this.loaded.get('scarf');if(!scarf||!this.shown.has('scarf'))return;
  // Fit in Blender already includes layering ease. Reset the source positions
  // without bending each texture row around whichever outfit was selected.
  scarf.meshes.forEach((mesh,m)=>{mesh.geometry.attributes.position.array.set(scarf.rest[m]);mesh.geometry.attributes.position.needsUpdate=true;});
  scarf.cloth?.reset();
 }
 update(delta,motion){
  for(const id of this.shown)if(id!=='wrap'&&id!=='scarf')this.loaded.get(id).cloth?.update(delta,motion);
  for(const accessory of ['wrap','scarf'])if(this.shown.has(accessory)){
   const wrap=this.loaded.get(accessory).cloth;wrap.update(delta,motion);
   const beneath=this.loaded.get(this.state.outfit!=='base'?this.state.outfit:this.state.bottom)?.cloth;
   if(beneath){for(let i=0;i<wrap.sections.length;i++)wrap.sections[i].copy(beneath.sections[i]);wrap.time=beneath.time;wrap.energy=beneath.energy;wrap.uniforms.skirtTime.value=beneath.time;wrap.uniforms.skirtEnergy.value=beneath.energy;}
  }
 }
 trim(){
  const unused=[...this.loaded.values()].filter(x=>!this.shown.has(x.id)).sort((a,b)=>b.lastUsed-a.lastUsed);
  for(const item of unused.slice(3)){
   const textures=new Set();for(const mesh of item.meshes){mesh.removeFromParent();mesh.geometry.dispose();mesh.skeleton.dispose();for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){for(const value of Object.values(material))if(value?.isTexture)textures.add(value);material.dispose();}}
   textures.forEach(texture=>{texture.dispose();texture.source?.data?.close?.()});this.loaded.delete(item.id);
  }
 }
}

function installBottomLayer(meshes){
 const tucked={value:0};
 for(const mesh of meshes)for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
  const compile=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.onBeforeCompile=(shader,renderer)=>{
   compile.call(material,shader,renderer);shader.uniforms.bottomUnderShirt=tucked;
   shader.vertexShader='varying float vBottomHeight;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvBottomHeight=position.y;');
   shader.fragmentShader='uniform float bottomUnderShirt;\nvarying float vBottomHeight;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(bottomUnderShirt>.5&&vBottomHeight>(bottomUnderShirt>2.5?1.79:(bottomUnderShirt>1.5?1.70:1.80)))discard;');
  };
  material.customProgramCacheKey=()=>key+'|bottom-layer-3';material.needsUpdate=true;
 }
 return tucked;
}

// Hide skin enclosed by clothing, while preserving the uncovered neckline,
// arms and tail. The mask is evaluated in the undeformed body coordinates so
// it follows the same bones as the garment and cannot slide over the skin.
export function installWardrobeCoverage(character){
 const dress={value:0},top={value:0},bottom={value:0},hat={value:0},done=new Set();
 character.traverse(mesh=>{
  if(!mesh.isSkinnedMesh||/^(Outfit_|Wardrobe_)/.test(mesh.name))return;
  const {position,skinIndex,skinWeight}=mesh.geometry.attributes;
  const arms=new Set(mesh.skeleton.bones.map((b,i)=>/^(Arm|Fin)/.test(b.name)?i:-1));
  const weights=new Float32Array(position.count);
  for(let i=0;i<weights.length;i++)for(let j=0;j<4;j++)if(arms.has(skinIndex.getComponent(i,j)))weights[i]+=skinWeight.getComponent(i,j);
  mesh.geometry.setAttribute('wardrobeArm',new THREE.BufferAttribute(weights,1));
  mesh.getVertexPosition=function(index,target){
   THREE.Mesh.prototype.getVertexPosition.call(this,index,target);
   fitWardrobeSkin(target,weights[index],dress.value>.5||(top.value>.5&&top.value<2.5),bottom.value>.5&&top.value<.5,top.value>1.5&&top.value<2.5);
   return this.applyBoneTransform(index,target);
  };
  for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
   if(done.has(material))continue;done.add(material);
   const compile=material.onBeforeCompile,key=material.customProgramCacheKey();
   material.onBeforeCompile=(shader,renderer)=>{
    compile.call(material,shader,renderer);Object.assign(shader.uniforms,{wardrobeDress:dress,wardrobeTop:top,wardrobeBottom:bottom,wardrobeHat:hat});
    shader.vertexShader='uniform float wardrobeDress;\nuniform float wardrobeBottom;\nuniform float wardrobeTop;\nuniform float wardrobeHat;\nattribute float wardrobeArm;\nvarying vec3 vWardrobeRest;\nvarying float vWardrobeArm;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
     vWardrobeRest=position;vWardrobeArm=wardrobeArm;
     // Clothing never rescales the exposed neck, shoulders or flippers.
     // The small concealed torso insert blends out fully below the neckline.
     if((wardrobeTop>.5&&wardrobeTop<2.5)||wardrobeDress>.5){
      float inset=smoothstep(.80,1.60,position.y)*(1.-smoothstep(2.03,2.35,position.y))*(1.-smoothstep(.08,.30,wardrobeArm));
      if(wardrobeTop>1.5&&wardrobeTop<2.5)inset*=1.-smoothstep(.08,.14,position.z)*smoothstep(2.14+abs(position.x)*1.5,2.18+abs(position.x)*1.5,position.y);
      transformed.x*=1.-.24*inset;
      transformed.z=.14+(transformed.z-.14)*(1.-.32*inset);
     }
     if(wardrobeBottom>.5&&wardrobeTop<.5){
      float waist=smoothstep(1.45,1.80,position.y)*(1.-smoothstep(1.86,2.30,position.y))*(1.-smoothstep(.08,.30,wardrobeArm));
      transformed.x*=1.-.30*waist;transformed.z=.05+(transformed.z-.05)*(1.-.35*waist);
     }
    `);
    shader.fragmentShader='uniform float wardrobeDress;\nuniform float wardrobeTop;\nuniform float wardrobeBottom;\nvarying vec3 vWardrobeRest;\nvarying float vWardrobeArm;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
      float wy=vWardrobeRest.y;float wx=abs(vWardrobeRest.x);bool torso=vWardrobeArm<.30;
      float neck=wardrobeDress<1.5?2.28:(wardrobeDress<2.5?(vWardrobeRest.z>.13?2.34:2.20):(wardrobeDress<3.5?2.49:(vWardrobeRest.z>.07?2.38:2.05)));
      float dressHem=.72;
      if(wardrobeDress>.5&&torso&&wy>dressHem&&wy<neck)discard;
      float topNeck=wardrobeTop<1.5?2.26:(vWardrobeRest.z>.08?2.03+(.19+min(wx,.32)*.92)*(1.-smoothstep(.22,.31,wx)):2.03);
      bool openHalter=wardrobeTop>1.5&&vWardrobeRest.z>.08&&wy>2.14+wx*1.5;
      if(wardrobeTop>.5&&wardrobeTop<2.5&&torso&&wy>1.64&&wy<topNeck&&!openHalter)discard;
      float sleeveLength=(wx-.40)*.69+(2.59-wy)*.72;

      float bottomHem=wardrobeBottom<1.5?.98:(wardrobeBottom<2.5?.78:.24);
      if(wardrobeBottom>.5&&torso&&wy<1.83&&wy>bottomHem)discard;
    `);
   };
   material.customProgramCacheKey=()=>key+'|wardrobe-coverage-6';material.needsUpdate=true;
  }
 });
 return {set(ids){dress.value=ids.has('moonlight')?1:ids.has('pink')?2:ids.has('floral')?3:ids.has('bloom')?4:0;top.value=ids.has('stripe')?1:ids.has('halter')?2:ids.has('noir')?3:0;hat.value=ids.has('hat')?1:0;bottom.value=ids.has('shorts')?1:ids.has('trousers')?2:ids.has('satin')?3:0}};
}
