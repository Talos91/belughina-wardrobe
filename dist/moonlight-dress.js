import * as THREE from 'three';
import {SkirtDynamics} from './skirt-dynamics.js?v=folio-release-3';

/** Attach a fitted garment to the existing skeleton, never a second animated rig. */
export function attachMoonlightDress(character,garmentScene,name='Outfit_moonlight'){
  character.updateMatrixWorld(true);garmentScene.updateMatrixWorld(true);
  const meshes=[];garmentScene.traverse(mesh=>{if(mesh.isSkinnedMesh)meshes.push(mesh)});
  if(!meshes.length)throw new Error('The moonlight dress has no skin.');
  for(const mesh of meshes){
    const bones=mesh.skeleton.bones.map(b=>character.getObjectByName(b.name));
    if(bones.some(b=>!b?.isBone))throw new Error('The dress and character skeletons do not match.');
    const skeleton=new THREE.Skeleton(bones,mesh.skeleton.boneInverses.map(m=>m.clone()));
    const matrix=mesh.matrixWorld.clone(),bind=mesh.bindMatrix.clone();
    mesh.removeFromParent();character.add(mesh);matrix.decompose(mesh.position,mesh.quaternion,mesh.scale);
    mesh.bind(skeleton,bind);mesh.name=name;mesh.frustumCulled=false;
  }
  return meshes;
}

/** Standard garment coverage: conceal the torso enclosed by the fitted gown,
 * without changing the original mesh or concealing flippers, face or tail. */
export function installGownCoverage(character){
  const enabled={value:0},done=new Set();
  character.traverse(mesh=>{
    if(!mesh.isSkinnedMesh||mesh.name.startsWith('Outfit_'))return;
    const {position,skinIndex,skinWeight}=mesh.geometry.attributes,cover=new Float32Array(position.count);
    const arms=new Set(mesh.skeleton.bones.map((bone,i)=>/^(Arm|Fin)/.test(bone.name)?i:-1));
    for(let i=0;i<cover.length;i++){
      let arm=0;for(let j=0;j<4;j++)if(arms.has(skinIndex.getComponent(i,j)))arm+=skinWeight.getComponent(i,j);
      cover[i]=position.getY(i)<2.32&&position.getY(i)>.80&&arm<.3?1:0;
    }
    mesh.geometry.setAttribute('gownCovered',new THREE.BufferAttribute(cover,1));
    for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
      if(done.has(material))continue;done.add(material);
      const compile=material.onBeforeCompile,cache=material.customProgramCacheKey.bind(material);
      material.onBeforeCompile=(shader,renderer)=>{
        compile.call(material,shader,renderer);shader.uniforms.gownWorn=enabled;
        shader.vertexShader='attribute float gownCovered;\nvarying float vGownCovered;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvGownCovered=gownCovered;');
        shader.fragmentShader='uniform float gownWorn;\nvarying float vGownCovered;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(gownWorn>.5&&vGownCovered>.5)discard;');
      };
      const originalKey=cache();material.customProgramCacheKey=()=>originalKey+'|gown-coverage-1';material.needsUpdate=true;
    }
  });
  return {setEnabled(value){enabled.value=value?1:0}};
}

/** Texture-aware color controls preserve shading and each ribbon's original edge. */
export function installRibbonColors(meshes){
  const blue={value:new THREE.Color()},ivory={value:new THREE.Color()};
  const blueOn={value:0},ivoryOn={value:0};
  for(const mesh of meshes){
    const material=mesh.material;material.normalScale.multiplyScalar(.65);
    // The garment contains its own inner lining. Drawing the reverse of
    // both shells lets that lining cut jagged patches through the ribbons.
    material.side=THREE.FrontSide;
    material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,{ribbonBlue:blue,ribbonIvory:ivory,ribbonBlueOn:blueOn,ribbonIvoryOn:ivoryOn});
      shader.fragmentShader=`uniform vec3 ribbonBlue;\nuniform vec3 ribbonIvory;\nuniform float ribbonBlueOn;\nuniform float ribbonIvoryOn;\n${shader.fragmentShader}`;
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        float ribbonLight=max(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722)),.015);
        float blueRibbon=smoothstep(.035,.14,(diffuseColor.b-diffuseColor.r)/ribbonLight);
        vec3 blueTint=ribbonBlue*clamp(ribbonLight/.42,.18,1.7);
        vec3 ivoryTint=ribbonIvory*clamp(ribbonLight/.60,.18,1.7);
        diffuseColor.rgb=mix(diffuseColor.rgb,blueTint,blueRibbon*ribbonBlueOn);
        diffuseColor.rgb=mix(diffuseColor.rgb,ivoryTint,(1.0-blueRibbon)*ribbonIvoryOn);
      `);
    };
    material.customProgramCacheKey=()=> 'moonlight-ribbons-1';material.needsUpdate=true;
  }
  return {setColors(primary,secondary){blueOn.value=primary?1:0;ivoryOn.value=secondary?1:0;if(primary)blue.value.set(primary);if(secondary)ivory.value.set(secondary)}};
}

export class MoonlightMotion extends SkirtDynamics {}
